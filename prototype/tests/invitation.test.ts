/**
 * MESHORA — Invitations (format partagé avec Android, InvitationTest.kt).
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { MeshoraCrypto } from '../src/core/crypto';
import { invitationLink, parseInvitation, newRoomCode, isValidRoom } from '../src/core/invitation';

let fails = 0;
const ok = (cond: boolean, label: string) => { console.log(`${cond ? '✅' : '❌'} ${label}`); if (!cond) fails++; };

(async () => {
  const k = (await MeshoraCrypto.generateIdentityKeyPair()).publicKeyHex;
  const inv = { room: newRoomCode(), publicKeyHex: k, alias: 'Cédric & co', relayUrl: null };
  const link = invitationLink(inv, 'https://meshora.pages.dev/app/');
  ok(link.startsWith('https://meshora.pages.dev/app/#join='), 'paramètres dans le fragment (#), jamais dans la requête');
  ok(JSON.stringify(parseInvitation(link)) === JSON.stringify(inv), 'aller-retour lien https');
  ok(JSON.stringify(parseInvitation('meshora://join#' + link.split('#')[1])) === JSON.stringify(inv), 'aller-retour lien meshora://');
  const withRelay = { ...inv, relayUrl: 'wss://relay.example.org/x?y=1' };
  ok(JSON.stringify(parseInvitation(invitationLink(withRelay, 'https://x/app/'))) === JSON.stringify(withRelay), 'relais wss:// conservé');
  ok(parseInvitation(invitationLink({ ...inv, relayUrl: 'ws://evil.example' }, 'https://x/app/')) === null, 'relais ws:// distant refusé');
  ok(parseInvitation(invitationLink({ ...inv, relayUrl: 'https://evil.example' }, 'https://x/app/')) === null, 'relais https:// refusé');
  ok(parseInvitation('https://meshora.pages.dev/app/#join=../x&k=' + k) === null, 'groupe invalide refusé');
  ok(parseInvitation('https://meshora.pages.dev/app/#join=g1&k=zz') === null, 'clé invalide refusée');
  ok(parseInvitation('https://meshora.pages.dev/app/') === null, 'lien sans invitation refusé');
  const p = parseInvitation('meshora://join#join=g1&k=' + k + '&n=' + encodeURIComponent('A\n\u0007B' + 'x'.repeat(80)));
  ok(!!p && !/[\u0000-\u001f]/.test(p.alias) && p.alias.length <= 40, 'nom nettoyé (contrôles retirés, 40 caractères max)');
  const codes = new Set(Array.from({ length: 200 }, newRoomCode));
  ok(codes.size === 200 && [...codes].every((c) => isValidRoom(c) && c.length === 13), 'codes de groupe aléatoires et valides');
  console.log(`\nRÉSULTAT : ${fails === 0 ? 'toutes les vérifications réussies' : fails + ' échec(s)'}`);
  process.exit(fails ? 1 : 0);
})();
