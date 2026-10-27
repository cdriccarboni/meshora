/**
 * MESHORA V0.4 étape A — prékeys signées, HKDF, enveloppe v3, rotation et effacement.
 * Référence : tools/audit/prekey-reference.py → docs/tests/v0.4/prekey-vectors.json (relu aussi par Kotlin).
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { readFileSync } from 'node:fs';
import { MeshoraCrypto, envelopeSignedString, envelopeHkdfInfo, prekeySignedString, EncryptedEnvelope } from '../src/core/crypto';
import { PrekeyStore, KVStore, PREKEY_ROTATE_MS, PREKEY_VALID_MS, PREKEY_GRACE_MS } from '../src/core/prekeys';

const v = JSON.parse(readFileSync(new URL('../../docs/tests/v0.4/prekey-vectors.json', import.meta.url), 'utf8'));
let fails = 0;
const ok = (c: boolean, l: string) => { console.log(`${c ? '✅' : '❌'} ${l}`); if (!c) fails++; };
const memStore = (): KVStore => { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, x) => void m.set(k, x) }; };
const throws = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };

(async () => {
  // --- 1. Vecteurs communs (Python ↔ TypeScript)
  const vNow = v.prekey.expiresAt - 24 * 3600 * 1000;
  ok(prekeySignedString(v.bobIdentityPublicHex, v.prekey) === v.prekeySignedString, 'chaîne signée de la prékey = référence');
  ok((await MeshoraCrypto.prekeyId(v.prekey.publicKeyHex)) === v.prekey.id, 'identifiant de prékey = référence');
  ok(await MeshoraCrypto.verifyPrekey(v.bobIdentityPublicHex, v.prekey, vNow), 'prékey signée par Python acceptée');
  ok(!(await MeshoraCrypto.verifyPrekey(v.aliceIdentityPublicHex, v.prekey, vNow)), 'prékey refusée pour une autre identité');
  ok(!(await MeshoraCrypto.verifyPrekey(v.bobIdentityPublicHex, v.prekey, v.prekey.expiresAt + 1)), 'prékey échue refusée');
  ok(!(await MeshoraCrypto.verifyPrekey(v.bobIdentityPublicHex, { ...v.prekey, expiresAt: v.prekey.expiresAt + 1 }, vNow)), 'échéance modifiée → signature invalide');
  ok(envelopeHkdfInfo(v.aliceIdentityPublicHex, v.bobIdentityPublicHex, v.prekey.id) === v.hkdfInfo, 'info HKDF = référence');
  ok(
    (await MeshoraCrypto.v3MessageKeyHex(v.prekeyPrivatePkcs8Hex, v.envelope.ephemeralPublicKeyHex, v.envelope.saltHex, v.hkdfInfo)) === v.messageKeyHex,
    'clé de message (destinataire) = référence Python'
  );
  ok(
    (await MeshoraCrypto.v3MessageKeyHex(v.ephemeralPrivatePkcs8Hex, v.prekey.publicKeyHex, v.envelope.saltHex, v.hkdfInfo)) === v.messageKeyHex,
    'clé de message (expéditeur) = référence Python'
  );
  ok(envelopeSignedString(v.envelope) === v.envelopeSignedString, 'chaîne signée de l\'enveloppe v3 = référence');
  const dec = await MeshoraCrypto.decryptEnvelope({ envelope: v.envelope, recipientPrivateKeyPkcs8Hex: v.bobIdentityPrivatePkcs8Hex, prekeyLookup: (id) => (id === v.prekey.id ? v.prekeyPrivatePkcs8Hex : null) });
  ok(dec.plaintext === v.plaintext, 'enveloppe v3 produite par Python déchiffrée');
  ok(await throws(() => MeshoraCrypto.decryptEnvelope({ envelope: v.envelope, recipientPrivateKeyPkcs8Hex: v.bobIdentityPrivatePkcs8Hex })), 'sans la prékey : illisible, même avec la clé d\'identité');
  for (const f of ['prekeyId', 'saltHex', 'timestamp', 'v'] as const) {
    const t = { ...v.envelope, [f]: f === 'timestamp' ? v.envelope.timestamp + 1 : f === 'v' ? undefined : f === 'saltHex' ? '00'.repeat(32) : 'ffffffffffffffff' };
    ok(await throws(() => MeshoraCrypto.decryptEnvelope({ envelope: t, recipientPrivateKeyPkcs8Hex: v.bobIdentityPrivatePkcs8Hex, prekeyLookup: () => v.prekeyPrivatePkcs8Hex })), `champ « ${f} » altéré → refusé`);
  }

  // --- 2. Aller-retour TypeScript ↔ TypeScript, et compatibilité v2
  const alice = await MeshoraCrypto.generateIdentityKeyPair();
  const bob = await MeshoraCrypto.generateIdentityKeyPair();
  let t = 1_800_000_000_000;
  const bobStore = new PrekeyStore(memStore(), () => t);
  const aliceStore = new PrekeyStore(memStore(), () => t);
  const bp1 = await bobStore.current(bob.privateKey, bob.publicKeyHex);
  ok(bp1.expiresAt === t + PREKEY_VALID_MS, 'prékey annoncée pour 8 jours');
  ok((await bobStore.current(bob.privateKey, bob.publicKeyHex)).id === bp1.id, 'même prékey tant qu\'elle a moins de 7 jours');
  ok(await aliceStore.rememberPeer(bob.publicKeyHex, bp1), 'Alice mémorise la prékey vérifiée de Bob');
  ok(!(await aliceStore.rememberPeer(alice.publicKeyHex, bp1)), 'prékey de Bob refusée si présentée pour Alice');
  const send = async (txt: string): Promise<EncryptedEnvelope> => {
    const pk = aliceStore.peer(bob.publicKeyHex);
    return pk
      ? MeshoraCrypto.encryptEnvelopeV3({ messageId: 'm-' + txt, senderPrivateKey: alice.privateKey, senderPublicKeyHex: alice.publicKeyHex, recipientPublicKeyHex: bob.publicKeyHex, prekey: pk, plaintext: txt })
      : MeshoraCrypto.encryptEnvelope({ messageId: 'm-' + txt, senderPrivateKey: alice.privateKey, senderPublicKeyHex: alice.publicKeyHex, recipientPublicKeyHex: bob.publicKeyHex, plaintext: txt });
  };
  const read = (e: EncryptedEnvelope) => MeshoraCrypto.decryptEnvelope({ envelope: e, recipientPrivateKeyPkcs8Hex: bob.privateKeyPkcs8Hex, prekeyLookup: (id) => bobStore.privateFor(id) });
  const e1 = await send('semaine 1');
  ok(e1.v === 3 && e1.prekeyId === bp1.id, 'Alice envoie en v3 (prékey connue)');
  ok((await read(e1)).plaintext === 'semaine 1', 'Bob lit le message v3');
  const ack = await MeshoraCrypto.createSignedAck(e1, bob.privateKey);
  ok(await MeshoraCrypto.verifySignedAck(ack), 'accusé v2 inchangé sur une enveloppe v3');
  const legacy = await MeshoraCrypto.encryptEnvelope({ messageId: 'old', senderPrivateKey: alice.privateKey, senderPublicKeyHex: alice.publicKeyHex, recipientPublicKeyHex: bob.publicKeyHex, plaintext: 'ancien client' });
  ok(legacy.v === undefined && (await read(legacy)).plaintext === 'ancien client', 'un ancien client (v2) reste lisible');
  const carol = await MeshoraCrypto.generateIdentityKeyPair();
  ok(await throws(() => MeshoraCrypto.decryptEnvelope({ envelope: e1, recipientPrivateKeyPkcs8Hex: carol.privateKeyPkcs8Hex, prekeyLookup: () => null })), 'un tiers ne lit pas le v3');

  // --- 3. Rotation et effacement (horloge avancée)
  t += PREKEY_ROTATE_MS + 1;
  const bp2 = await bobStore.current(bob.privateKey, bob.publicKeyHex);
  ok(bp2.id !== bp1.id, 'nouvelle prékey après 7 jours');
  ok((await read(e1)).plaintext === 'semaine 1', 'message capté en semaine 1 encore lisible pendant le délai de grâce');
  await aliceStore.rememberPeer(bob.publicKeyHex, bp2);
  ok(aliceStore.peer(bob.publicKeyHex)?.id === bp2.id, 'Alice passe à la nouvelle prékey');
  ok(!(await aliceStore.rememberPeer(bob.publicKeyHex, bp1)) || aliceStore.peer(bob.publicKeyHex)?.id === bp2.id, 'pas de retour à une prékey plus ancienne');
  t = bp1.expiresAt + PREKEY_GRACE_MS + 1;
  ok(bobStore.privateFor(bp1.id) === null, 'prékey 1 effacée (échéance + 7 jours)');
  ok(await throws(() => read(e1)), 'CONFIDENTIALITÉ PERSISTANTE : le message de la semaine 1 capté est désormais illisible, même avec le téléphone de Bob');
  ok(aliceStore.peer(bob.publicKeyHex) === null, 'prékey échue ignorée par Alice → repli v2 tant que Bob n\'en annonce pas de nouvelle');
  const e3 = await send('repli');
  ok(e3.v === undefined && (await read(e3)).plaintext === 'repli', 'repli v2 fonctionnel');

  console.log(`\nRÉSULTAT : ${fails === 0 ? 'toutes les vérifications réussies' : fails + ' échec(s)'}`);
  process.exit(fails ? 1 : 0);
})();
