/**
 * Génère (et vérifie côté web) les vecteurs d'interopérabilité trame + annonce partagés avec Android.
 * Usage : npx tsx tests/mesh-interop-vectors.ts  → affiche du JSON ; vérifie l'encodage de la trame de référence.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { encodeFrame, decodeFrame, FrameType, splitFrames, Reassembler } from '../src/mesh/meshFrame';
import { MeshoraCrypto, bytesToHex } from '../src/core/crypto';

const REF_HEX = '01010700' + '000102030405060708090a0b0c0d0e0f' + '0001' + '0003' + '0003' + '616263';
let fails = 0;
const check = (c: boolean, label: string) => { console.log(`${c ? '✅' : '❌'} ${label}`); if (!c) fails++; };

const ref = encodeFrame({ type: FrameType.ENVELOPE, ttl: 7, flags: 0, messageId: Uint8Array.from({ length: 16 }, (_, i) => i), fragIndex: 1, fragCount: 3, payload: new TextEncoder().encode('abc') });
check(bytesToHex(ref) === REF_HEX, 'trame de référence identique au format Android');
check(decodeFrame(ref)?.fragCount === 3, 'décodage de la trame de référence');
check(decodeFrame(new Uint8Array(10)) === null, 'entrée trop courte rejetée');
const big = new Uint8Array(5000).map((_, i) => i % 251);
const frames = splitFrames(FrameType.ENVELOPE, new Uint8Array(16), big, 7, 180);
const r = new Reassembler();
let out: Uint8Array | null = null;
for (const f of frames.reverse()) out = r.accept(decodeFrame(encodeFrame(f))!) ?? out;
check(!!out && bytesToHex(out) === bytesToHex(big), 'fragmentation 180 octets et réassemblage dans le désordre');

if (process.argv.includes('--announce')) {
  const kp = await MeshoraCrypto.generateIdentityKeyPair();
  const ts = 1793030000000;
  const alias = 'Mac-Web';
  const signature = await MeshoraCrypto.signData(kp.privateKey, `MESHORA-ANNOUNCE|v1|${kp.publicKeyHex}|${alias}|${ts}`);
  console.log('ANNOUNCE:' + JSON.stringify({ publicKey: kp.publicKeyHex, alias, timestamp: ts, signature }));
}
console.log(`RÉSULTAT : ${fails === 0 ? 'OK' : fails + ' échec(s)'}`);
if (fails) process.exit(1);
