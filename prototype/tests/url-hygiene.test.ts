/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Tests de l'hygiène d'adresse et de la validation des relais (contre-audit V0.2).
 */
import { stripTrackingParams, isAcceptableRelayUrl } from '../src/core/urlHygiene';

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string, detail = '') {
  if (cond) { pass++; console.log(`✅ ${label}`); } else { fail++; console.error(`❌ ${label} ${detail}`); }
}

const base = 'https://meshora.pages.dev/app/';
check(stripTrackingParams(base) === null, 'Adresse propre inchangée');
check(stripTrackingParams(base + '?utm_source=x&utm_medium=y') === base, 'utm_* retirés, « ? » supprimé');
const keep = stripTrackingParams(base + '?relay=wss%3A%2F%2Fr.example&utm_campaign=z&room=abc&invite=K1#messages');
check(keep === base + '?relay=wss%3A%2F%2Fr.example&room=abc&invite=K1#messages', 'Paramètres fonctionnels et fragment conservés', String(keep));
check(stripTrackingParams(base + '?UTM_Source=a&fbclid=b&gclid=c&pair=1') === base + '?pair=1', 'Casse et identifiants de clic gérés');
check(stripTrackingParams('pas une url') === null, 'Entrée invalide ignorée');

check(isAcceptableRelayUrl('wss://relay.example/ws'), 'wss:// accepté');
check(isAcceptableRelayUrl('ws://localhost:8787'), 'ws:// local accepté');
check(isAcceptableRelayUrl('ws://192.168.1.20:8787'), 'ws:// réseau privé accepté');
check(!isAcceptableRelayUrl('ws://relay.example'), 'ws:// public refusé (non chiffré)');
check(!isAcceptableRelayUrl('https://relay.example'), 'Schéma non WebSocket refusé');
check(!isAcceptableRelayUrl('wss://user:pw@relay.example'), 'Identifiants dans l’URL refusés');
check(!isAcceptableRelayUrl('javascript:alert(1)'), 'Schéma javascript: refusé');

console.log(`\nRÉSULTAT : ${pass}/${pass + fail} tests d'hygiène d'adresse réussis.`);
if (fail) process.exit(1);
