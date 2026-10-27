/**
 * MESHORA — Scellement de groupe Bluetooth : vecteurs communs Python / Kotlin / TypeScript.
 * Référence : tools/audit/group-seal-reference.py → docs/tests/v0.3/group-seal-vectors.json
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { readFileSync } from 'node:fs';
import { FrameType } from '../src/mesh/meshFrame';
import { seal, open, frameKey, idKey, frameId, DAY_MS } from '../src/mesh/groupSeal';

const v = JSON.parse(readFileSync(new URL('../../docs/tests/v0.3/group-seal-vectors.json', import.meta.url), 'utf8'));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));
let fails = 0;
const ok = (c: boolean, l: string) => { console.log(`${c ? '✅' : '❌'} ${l}`); if (!c) fails++; };

(async () => {
  ok(hex(await frameKey(v.room, v.day)) === v.frameKeyHex, 'clé de trame = référence Python');
  ok(hex(await idKey(v.room, v.day)) === v.idKeyHex, 'clé d\'identifiant = référence Python');
  ok(hex(await frameId(v.room, v.day, 'env|00ff')) === v.idEnvHex, 'identifiant de trame = référence Python');
  const sealed = await seal(v.room, v.day, FrameType.ANNOUNCE, new TextEncoder().encode('{"a":"b"}'), unhex(v.ivHex));
  ok(hex(sealed) === v.sealedHex, 'trame scellée = référence Python (et Kotlin)');
  const now = v.day * DAY_MS + 3600_000;
  const o = await open(v.room, sealed, now);
  ok(!!o && o.type === FrameType.ANNOUNCE && new TextDecoder().decode(o.data) === '{"a":"b"}', 'ouverture par le groupe');
  ok((await open('gautregroupe23', sealed, now)) === null, 'illisible pour un autre groupe');
  const bad = sealed.slice(); bad[40] ^= 1;
  ok((await open(v.room, bad, now)) === null, 'altération détectée');
  ok((await open(v.room, sealed, now + 2 * DAY_MS)) === null, 'trame de plus d\'un jour refusée');
  const a = await seal(v.room, v.day, FrameType.ENVELOPE, new Uint8Array(1));
  const b = await seal(v.room, v.day, FrameType.ENVELOPE, new Uint8Array(120));
  ok(a.length === b.length, 'tailles arrondies (128 octets)');
  console.log(`\nRÉSULTAT : ${fails === 0 ? 'toutes les vérifications réussies' : fails + ' échec(s)'}`);
  process.exit(fails ? 1 : 0);
})();
