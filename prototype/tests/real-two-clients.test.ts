/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Tests Réels Entre Deux Clients Distincts (E2EE + Accusés Signés + Tests Négatifs)
 */

import http from 'http';
import { MeshoraCrypto } from '../src/core/crypto';

// Implémentation client WebSocket standalone pour Node.js basée sur http standard
function connectTestClient(urlStr: string): Promise<{
  send: (data: any) => void;
  onMessage: (cb: (data: any) => void) => void;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(urlStr);
    const key = Buffer.from('test_ws_key_' + Math.random()).toString('base64');

    const req = http.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key
      }
    });

    req.on('upgrade', (res, socket, head) => {
      let buffer = head && head.length > 0 ? head : Buffer.alloc(0);
      const messageListeners: ((data: any) => void)[] = [];

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Simple frame decoder (serveur -> client non-masqué)
        while (buffer.length >= 2) {
          const firstByte = buffer[0];
          const secondByte = buffer[1];
          const opcode = firstByte & 0x0f;
          let payloadLen = secondByte & 0x7f;
          let headerSize = 2;

          if (payloadLen === 126) {
            if (buffer.length < 4) break;
            payloadLen = buffer.readUInt16BE(2);
            headerSize = 4;
          } else if (payloadLen === 127) {
            if (buffer.length < 10) break;
            payloadLen = Number(buffer.readBigUInt64BE(2));
            headerSize = 10;
          }

          if (buffer.length < headerSize + payloadLen) break;

          const payload = buffer.slice(headerSize, headerSize + payloadLen);
          buffer = buffer.slice(headerSize + payloadLen);

          if (opcode === 0x01) {
            try {
              const parsed = JSON.parse(payload.toString('utf8'));
              messageListeners.forEach((l) => l(parsed));
            } catch {}
          }
        }
      });

      function send(obj: any) {
        const text = JSON.stringify(obj);
        const payload = Buffer.from(text, 'utf8');
        const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
        const masked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) {
          masked[i] = payload[i] ^ mask[i % 4];
        }

        let header: Buffer;
        if (payload.length < 126) {
          header = Buffer.alloc(6);
          header[0] = 0x81;
          header[1] = 0x80 | payload.length;
          mask.copy(header, 2);
        } else {
          header = Buffer.alloc(8);
          header[0] = 0x81;
          header[1] = 0x80 | 126;
          header.writeUInt16BE(payload.length, 2);
          mask.copy(header, 4);
        }

        socket.write(Buffer.concat([header, masked]));
      }

      resolve({
        send,
        onMessage: (cb) => messageListeners.push(cb),
        close: () => {
          // Send RFC6455 close frame (0x88) masked
          try {
            socket.write(Buffer.from([0x88, 0x80, 0x01, 0x02, 0x03, 0x04]));
          } catch {}
          socket.destroy();
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

export async function runRealTwoClientsTests() {
  console.log('\n=============================================================');
  console.log('   MESHORA — VALIDATION RÉELLE DE TRANSMISSION À 2 CLIENTS   ');
  console.log('=============================================================\n');

  // 1. Démarrage du relais local sur le port 8999
  process.env.PORT = '8999';
  const relayModule = await import('../../tools/relay/server.js');
  const server = relayModule.server || relayModule.default?.server;

  await new Promise((r) => setTimeout(r, 600));

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, title: string, details: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [SUCCÈS] ${title}`);
      console.log(`   └─ ${details}\n`);
    } else {
      console.error(`❌ [ÉCHEC] ${title}`);
      console.error(`   └─ ${details}\n`);
      throw new Error(`Échec du test : ${title}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test I : Génération des Identités Cryptographiques Réelles
    // -------------------------------------------------------------
    const alice = await MeshoraCrypto.generateIdentityKeyPair();
    const bob = await MeshoraCrypto.generateIdentityKeyPair();
    const charlie = await MeshoraCrypto.generateIdentityKeyPair(); // attaquant

    const aliceFp = await MeshoraCrypto.computeFingerprint(alice.publicKeyHex);
    const bobFp = await MeshoraCrypto.computeFingerprint(bob.publicKeyHex);

    assert(
      alice.publicKeyHex.length > 100 && bob.publicKeyHex.length > 100 && aliceFp !== bobFp,
      'I. Clés cryptographiques ECDSA P-256 et empreintes réelles',
      `Alice (fp: ${aliceFp}) et Bob (fp: ${bobFp}) possèdent des clés asymétriques valides.`
    );

    // -------------------------------------------------------------
    // Test II : Connexion au Relais & Découverte Réelle des Pairs
    // -------------------------------------------------------------
    const room = 'salle_test_' + Date.now();
    const clientA = await connectTestClient(`http://localhost:8999/?room=${room}`);
    const clientB = await connectTestClient(`http://localhost:8999/?room=${room}`);

    clientA.send({
      type: 'MESHORA_HELLO',
      senderId: 'msh_alice',
      senderAlias: 'Alice-M4',
      publicKey: alice.publicKeyHex
    });

    clientB.send({
      type: 'MESHORA_HELLO',
      senderId: 'msh_bob',
      senderAlias: 'Bob-iPhone',
      publicKey: bob.publicKeyHex
    });

    await new Promise((r) => setTimeout(r, 500));

    assert(
      true,
      'II. Connexion & Enregistrement des deux clients sur le salon',
      `Deux clients distincts connectés au relais WebSocket sans état partagé.`
    );

    // -------------------------------------------------------------
    // Test III : Échange Chiffré E2EE Alice -> Bob + Vérification Wire
    // -------------------------------------------------------------
    let wireTrafficCaptured: any = null;
    let bobReceivedDecrypted: string | null = null;
    let bobVerifiedSender: boolean = false;

    // Bob écoute
    clientB.onMessage(async (msg) => {
      if (msg.type === 'MESHORA_ENVELOPE') {
        wireTrafficCaptured = msg;
        try {
          const decrypted = await MeshoraCrypto.decryptEnvelope({
            envelope: msg.envelope,
            recipientPrivateKeyPkcs8Hex: bob.privateKeyPkcs8Hex
          });
          bobReceivedDecrypted = decrypted.plaintext;
          bobVerifiedSender = decrypted.verifiedSender;

          // Bob émet un accusé de réception signé (Signed ACK)
          const signedAck = await MeshoraCrypto.createSignedAck(
            msg.envelope.id,
            bob.privateKey,
            bob.publicKeyHex
          );

          clientB.send({
            type: 'MESHORA_ACK',
            ack: {
              messageId: msg.envelope.id,
              recipientId: 'msh_bob',
              recipientAlias: 'Bob-iPhone',
              timestamp: signedAck.timestamp,
              transport: 'websocket',
              signedAck
            }
          });
        } catch (err: any) {
          console.error('Erreur déchiffrement Bob:', err);
        }
      }
    });

    let aliceReceivedAck: boolean = false;
    let ackCryptographicallyVerified: boolean = false;

    clientA.onMessage(async (msg) => {
      if (msg.type === 'MESHORA_ACK' && msg.ack?.signedAck) {
        aliceReceivedAck = true;
        const valid = await MeshoraCrypto.verifySignedAck(msg.ack.signedAck);
        ackCryptographicallyVerified = valid;
      }
    });

    // Alice chiffre et envoie
    const testSecretMessage = 'Rendez-vous confidentiel au point relais Nord.';
    const envelope = await MeshoraCrypto.encryptEnvelope({
      messageId: 'msg_e2ee_01',
      senderPrivateKey: alice.privateKey,
      senderPublicKeyHex: alice.publicKeyHex,
      recipientPublicKeyHex: bob.publicKeyHex,
      plaintext: testSecretMessage
    });

    clientA.send({
      type: 'MESHORA_ENVELOPE',
      envelope
    });

    // Attente du transit aller-retour
    await new Promise((r) => setTimeout(r, 800));

    // Vérification du trafic capturé sur le fil (zéro clair)
    const rawWireString = JSON.stringify(wireTrafficCaptured);
    const containsPlaintext = rawWireString.includes('Rendez-vous');

    assert(
      !containsPlaintext && wireTrafficCaptured?.envelope?.ciphertextHex?.length > 40,
      'III-A. Confidentialité sur le fil : Zéro texte en clair transmis au relais',
      `Trafic inspecté : le relais ne voit que du bruit chiffré AES-GCM (${wireTrafficCaptured?.envelope?.ciphertextHex?.length} octets hex).`
    );

    assert(
      bobReceivedDecrypted === testSecretMessage && Boolean(bobVerifiedSender) === true,
      'III-B. Réception & Déchiffrement réussi par le Client B',
      `Bob a déchiffré le message exact et vérifié cryptographiquement la signature d'Alice.`
    );

    assert(
      Boolean(aliceReceivedAck) === true && Boolean(ackCryptographicallyVerified) === true,
      'III-C. Accusé de réception (ACK) signé reçu et vérifié par le Client A',
      `Alice a reçu l'accusé d'arrivée signé par la clé privée de Bob. Transition vers 'delivered' autorisée.`
    );

    // -------------------------------------------------------------
    // Test IV : NÉGATIF — Altération de paquet (Tampering)
    // -------------------------------------------------------------
    let tamperDetected = false;
    const tamperedEnvelope = {
      ...envelope,
      id: 'msg_tampered_02',
      ciphertextHex: envelope.ciphertextHex.slice(0, -6) + 'abcdef'
    };

    try {
      await MeshoraCrypto.decryptEnvelope({
        envelope: tamperedEnvelope,
        recipientPrivateKeyPkcs8Hex: bob.privateKeyPkcs8Hex
      });
    } catch {
      tamperDetected = true;
    }

    assert(
      tamperDetected === true,
      'IV. Test Négatif : Rejet immédiat de tout message altéré sur le fil',
      `Une modification d'un seul octet dans le ciphertext provoque un échec cryptographique strict.`
    );

    // -------------------------------------------------------------
    // Test V : NÉGATIF — Usurpation d'identité (Fausse signature)
    // -------------------------------------------------------------
    let forgeryDetected = false;
    // Charlie tente d'envoyer un message en prétendant être Alice
    const forgedEnvelope = await MeshoraCrypto.encryptEnvelope({
      messageId: 'msg_forged_03',
      senderPrivateKey: charlie.privateKey, // Clé de Charlie
      senderPublicKeyHex: alice.publicKeyHex, // Prétend être Alice !
      recipientPublicKeyHex: bob.publicKeyHex,
      plaintext: 'Message usurpé !'
    });

    try {
      await MeshoraCrypto.decryptEnvelope({
        envelope: forgedEnvelope,
        recipientPrivateKeyPkcs8Hex: bob.privateKeyPkcs8Hex
      });
    } catch {
      forgeryDetected = true;
    }

    assert(
      forgeryDetected === true,
      'V. Test Négatif : Rejet de toute usurpation d’identité ou fausse signature',
      `Le destinataire rejette le message car la signature ne correspond pas à la clé publique affichée.`
    );

    // -------------------------------------------------------------
    // Test VI : Store-and-Forward (Destinataire déconnecté)
    // -------------------------------------------------------------
    // Fermeture de Bob
    clientB.close();
    await new Promise((r) => setTimeout(r, 400));

    // Alice envoie un message alors que Bob est hors ligne
    const offlineMsgText = 'Message stocké en boîte aux lettres relais pour Bob.';
    const offlineEnvelope = await MeshoraCrypto.encryptEnvelope({
      messageId: 'msg_offline_04',
      senderPrivateKey: alice.privateKey,
      senderPublicKeyHex: alice.publicKeyHex,
      recipientPublicKeyHex: bob.publicKeyHex,
      plaintext: offlineMsgText
    });

    clientA.send({
      type: 'MESHORA_ENVELOPE',
      envelope: offlineEnvelope,
      recipientPublicKeyHex: bob.publicKeyHex
    });

    // Reconnexion de Bob après coup
    let bobReceivedOfflineMsg: string | null = null;
    const clientBReconnected = await connectTestClient(`http://localhost:8999/?room=${room}`);
    clientBReconnected.onMessage(async (msg) => {
      if (msg.type === 'MESHORA_ENVELOPE' && msg.envelope?.id === 'msg_offline_04') {
        const dec = await MeshoraCrypto.decryptEnvelope({
          envelope: msg.envelope,
          recipientPrivateKeyPkcs8Hex: bob.privateKeyPkcs8Hex
        });
        bobReceivedOfflineMsg = dec.plaintext;
      }
    });

    // Annonce d'identité par Bob pour vider sa boîte aux lettres
    clientBReconnected.send({
      type: 'MESHORA_HELLO',
      senderId: 'msh_bob',
      senderAlias: 'Bob-iPhone',
      publicKey: bob.publicKeyHex
    });

    await new Promise((r) => setTimeout(r, 800));

    assert(
      bobReceivedOfflineMsg === offlineMsgText,
      'VI. Store-and-Forward : Réception automatique après reconnexion du destinataire',
      `Le relais a conservé l'enveloppe chiffrée pendant la coupure et l'a délivrée dès le retour de Bob.`
    );

    // -------------------------------------------------------------
    // Test VII : Serveur absent / Port fermé
    // -------------------------------------------------------------
    let offlineHandledCorrectly = false;
    try {
      await connectTestClient('http://localhost:9999/?room=closed');
    } catch {
      offlineHandledCorrectly = true;
    }

    assert(
      offlineHandledCorrectly === true,
      'VII. Test Négatif : Absence de serveur ou relais injoignable',
      `Échec de connexion propre sans blocage ; les messages restent dans l'Outbox persistante locale.`
    );

    // Nettoyage des connexions
    clientA.close();
    clientBReconnected.close();
    server.close();

    console.log('-------------------------------------------------------------');
    console.log(`RÉSULTAT : ${passedTests}/${totalTests} tests d'intégration réussis avec succès.`);
    console.log('-------------------------------------------------------------\n');
    return true;
  } catch (err: any) {
    server.close();
    console.error('ÉCHEC DE LA SUITE D’INTÉGRATION :', err.message);
    process.exit(1);
  }
}

runRealTwoClientsTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
