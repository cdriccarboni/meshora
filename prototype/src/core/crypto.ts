/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Module Cryptographique Natif (WebCrypto)
 * 
 * Conforme à SECURITY.md §2-3 :
 * - Identité & Signatures : ECDSA P-256 / SHA-256
 * - Chiffrement de bout en bout (E2EE) : ECDH P-256 + AES-256-GCM
 * - Empreinte publique : SHA-256 tronquée et formatée
 * - Accusés de réception (ACK) signés
 * - Zéro secret ou texte en clair transmis au relais
 */

export interface KeyPairData {
  publicKeyHex: string;
  privateKeyPkcs8Hex: string;
}

export interface EncryptedEnvelope {
  id: string;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  ephemeralPublicKeyHex: string;
  ivHex: string;
  ciphertextHex: string;
  signatureHex: string;
  timestamp: number;
}

/**
 * Accusé de réception signé, version 2 (contre-audit V0.2) : lie l'identifiant, l'expéditeur,
 * le destinataire et l'empreinte de l'enveloppe effectivement reçue.
 * Chaîne signée : ACK2|messageId|senderPublicKeyHex|recipientPublicKeyHex|envelopeHash|timestamp
 * envelopeHash = SHA-256 (hex) de la chaîne UTF-8 envelope.signatureHex.
 */
export interface SignedAck {
  messageId: string;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  envelopeHash: string;
  timestamp: number;
  signatureHex: string;
}

// Helpers hex <-> Uint8Array
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getSubtle(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('WebCrypto API (crypto.subtle) non disponible dans cet environnement.');
}

export class MeshoraCrypto {
  /**
   * Génère une paire de clés d'identité ECDSA P-256
   */
  public static async generateIdentityKeyPair(): Promise<{
    publicKeyHex: string;
    privateKeyPkcs8Hex: string;
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  }> {
    const subtle = getSubtle();
    const keyPair = await subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );

    const spki = await subtle.exportKey('spki', keyPair.publicKey);
    const pkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKeyHex: bytesToHex(new Uint8Array(spki)),
      privateKeyPkcs8Hex: bytesToHex(new Uint8Array(pkcs8)),
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  /**
   * Importe une clé publique ECDSA depuis de l'hexadécimal
   */
  public static async importPublicKey(publicKeyHex: string): Promise<CryptoKey> {
    const subtle = getSubtle();
    const bytes = hexToBytes(publicKeyHex);
    return subtle.importKey(
      'spki',
      bytes as unknown as BufferSource,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['verify']
    );
  }

  /**
   * Importe une clé privée ECDSA depuis de l'hexadécimal
   */
  public static async importPrivateKey(privateKeyPkcs8Hex: string): Promise<CryptoKey> {
    const subtle = getSubtle();
    const bytes = hexToBytes(privateKeyPkcs8Hex);
    return subtle.importKey(
      'pkcs8',
      bytes as unknown as BufferSource,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign']
    );
  }

  /**
   * Calcule l'empreinte vérifiable (SHA-256) d'une clé publique
   */
  public static async computeFingerprint(publicKeyHex: string): Promise<string> {
    const subtle = getSubtle();
    const bytes = hexToBytes(publicKeyHex);
    const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
    const hex = bytesToHex(new Uint8Array(digest));
    // Découpage en blocs de 4 caractères pour lisibilité humaine
    return hex.substring(0, 32).match(/.{1,4}/g)?.join(':') || hex.substring(0, 32);
  }

  /**
   * Signe un contenu texte ou binaire avec une clé privée ECDSA
   */
  public static async signData(privateKey: CryptoKey, data: string | Uint8Array): Promise<string> {
    const subtle = getSubtle();
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const signature = await subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      privateKey,
      bytes as unknown as BufferSource
    );
    return bytesToHex(new Uint8Array(signature));
  }

  /**
   * Vérifie la signature ECDSA d'un contenu
   */
  public static async verifySignature(
    publicKeyHex: string,
    signatureHex: string,
    data: string | Uint8Array
  ): Promise<boolean> {
    try {
      const subtle = getSubtle();
      const publicKey = await this.importPublicKey(publicKeyHex);
      const signatureBytes = hexToBytes(signatureHex);
      const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

      return await subtle.verify(
        {
          name: 'ECDSA',
          hash: { name: 'SHA-256' }
        },
        publicKey,
        signatureBytes as unknown as BufferSource,
        dataBytes as unknown as BufferSource
      );
    } catch {
      return false;
    }
  }

  /**
   * Chiffre un message de bout en bout (E2EE) à destination d'une clé publique.
   * Utilise ECDH éphémère (P-256) + AES-256-GCM + Signature de l'expéditeur.
   */
  public static async encryptEnvelope(params: {
    messageId: string;
    senderPrivateKey: CryptoKey;
    senderPublicKeyHex: string;
    recipientPublicKeyHex: string;
    plaintext: string;
  }): Promise<EncryptedEnvelope> {
    const subtle = getSubtle();

    // 1. Génération paire ECDH éphémère
    const ephemeralKeyPair = await subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey']
    );

    // 2. Importation de la clé ECDH publique du destinataire
    // Comme la clé destinataire est stockée au format SPKI P-256, on l'importe en ECDH
    const recipientBytes = hexToBytes(params.recipientPublicKeyHex);
    const recipientEcdhKey = await subtle.importKey(
      'spki',
      recipientBytes as unknown as BufferSource,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // 3. Dérivation de la clé symétrique AES-256-GCM
    const aesKey = await subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientEcdhKey
      },
      ephemeralKeyPair.privateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt']
    );

    // 4. Chiffrement AES-GCM
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(params.plaintext);
    const ciphertextBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesKey,
      plaintextBytes
    );

    const ephemeralSpki = await subtle.exportKey('spki', ephemeralKeyPair.publicKey);
    const ephemeralPublicKeyHex = bytesToHex(new Uint8Array(ephemeralSpki));
    const ivHex = bytesToHex(iv);
    const ciphertextHex = bytesToHex(new Uint8Array(ciphertextBuffer));
    const timestamp = Date.now();

    // 5. Signature de l'enveloppe par l'expéditeur
    const payloadToSign = `${params.messageId}|${params.senderPublicKeyHex}|${params.recipientPublicKeyHex}|${ephemeralPublicKeyHex}|${ivHex}|${ciphertextHex}|${timestamp}`;
    const signatureHex = await this.signData(params.senderPrivateKey, payloadToSign);

    return {
      id: params.messageId,
      senderPublicKeyHex: params.senderPublicKeyHex,
      recipientPublicKeyHex: params.recipientPublicKeyHex,
      ephemeralPublicKeyHex,
      ivHex,
      ciphertextHex,
      signatureHex,
      timestamp
    };
  }

  /**
   * Déchiffre une enveloppe E2EE avec la clé privée du destinataire
   */
  public static async decryptEnvelope(params: {
    envelope: EncryptedEnvelope;
    recipientPrivateKeyPkcs8Hex: string;
  }): Promise<{
    plaintext: string;
    verifiedSender: boolean;
  }> {
    const subtle = getSubtle();
    const env = params.envelope;

    // 1. Vérification de la signature de l'expéditeur
    const payloadSigned = `${env.id}|${env.senderPublicKeyHex}|${env.recipientPublicKeyHex}|${env.ephemeralPublicKeyHex}|${env.ivHex}|${env.ciphertextHex}|${env.timestamp}`;
    const verifiedSender = await this.verifySignature(
      env.senderPublicKeyHex,
      env.signatureHex,
      payloadSigned
    );

    if (!verifiedSender) {
      throw new Error('ÉCHEC DE SÉCURITÉ : Signature de l’expéditeur invalide ou message altéré.');
    }

    // 2. Importation de la clé privée destinataire en mode ECDH
    const recipientBytes = hexToBytes(params.recipientPrivateKeyPkcs8Hex);
    const recipientEcdhPrivateKey = await subtle.importKey(
      'pkcs8',
      recipientBytes as unknown as BufferSource,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveKey']
    );

    // 3. Importation de la clé éphémère de l'enveloppe
    const ephemeralBytes = hexToBytes(env.ephemeralPublicKeyHex);
    const ephemeralKey = await subtle.importKey(
      'spki',
      ephemeralBytes as unknown as BufferSource,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // 4. Dérivation de la même clé AES-GCM
    const aesKey = await subtle.deriveKey(
      {
        name: 'ECDH',
        public: ephemeralKey
      },
      recipientEcdhPrivateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['decrypt']
    );

    // 5. Déchiffrement AES-GCM
    const iv = hexToBytes(env.ivHex);
    const ciphertext = hexToBytes(env.ciphertextHex);

    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource
      },
      aesKey,
      ciphertext as unknown as BufferSource
    );

    const plaintext = new TextDecoder().decode(decryptedBuffer);

    return {
      plaintext,
      verifiedSender: true
    };
  }

  /** Empreinte d'une enveloppe (SHA-256 hex de sa signature, qui couvre tous ses champs). */
  public static async envelopeHash(envelope: EncryptedEnvelope): Promise<string> {
    const digest = await getSubtle().digest('SHA-256', new TextEncoder().encode(envelope.signatureHex) as unknown as BufferSource);
    return bytesToHex(new Uint8Array(digest));
  }

  /** Crée l'accusé signé (v2) d'une enveloppe reçue et déchiffrée. */
  public static async createSignedAck(envelope: EncryptedEnvelope, recipientPrivateKey: CryptoKey): Promise<SignedAck> {
    const timestamp = Date.now();
    const envelopeHash = await this.envelopeHash(envelope);
    const payload = `ACK2|${envelope.id}|${envelope.senderPublicKeyHex}|${envelope.recipientPublicKeyHex}|${envelopeHash}|${timestamp}`;
    const signatureHex = await this.signData(recipientPrivateKey, payload);
    return {
      messageId: envelope.id,
      senderPublicKeyHex: envelope.senderPublicKeyHex,
      recipientPublicKeyHex: envelope.recipientPublicKeyHex,
      envelopeHash,
      timestamp,
      signatureHex
    };
  }

  /** Vérifie la signature d'un accusé v2 (le contrôle de correspondance avec l'envoi reste à l'appelant). */
  public static async verifySignedAck(ack: SignedAck): Promise<boolean> {
    if (!ack || typeof ack.senderPublicKeyHex !== 'string' || typeof ack.envelopeHash !== 'string') return false;
    const payload = `ACK2|${ack.messageId}|${ack.senderPublicKeyHex}|${ack.recipientPublicKeyHex}|${ack.envelopeHash}|${ack.timestamp}`;
    return this.verifySignature(ack.recipientPublicKeyHex, ack.signatureHex, payload);
  }
}
