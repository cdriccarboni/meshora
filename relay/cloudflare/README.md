# Relais de référence MESHORA — Cloudflare Workers + Durable Objects

| | |
|---|---|
| Préproduction | `wss://meshora-relay-preprod.acousmaticregietools.workers.dev` (santé : `/health`) |
| Production | **non déployée** — `npx wrangler@4 deploy --env production` seulement avec l'accord du directeur artistique |
| Protocole | V0.2, identique au relais Node `tools/relay/server.js` (docs/PROTOCOLE-V0.2.md §4) |
| Conformité | `tools/audit/relay-conformance.ts` : **13/13** contre le relais Node, `wrangler dev` et la préproduction (26/10/2026) |

## Pourquoi un portage plutôt que le serveur Node

Le relais Node lit lui-même les trames WebSocket sur des sockets TCP (`node:http` + `upgrade`). Un Worker ne peut pas faire cela : Cloudflare termine la connexion WebSocket et livre des messages. Le portage :

| Relais Node | Worker + Durable Object |
|---|---|
| Un processus, tous les salons en mémoire | **Un Durable Object par salon** (`idFromName(room)`), une seule instance au monde par salon |
| Analyse RFC 6455 maison (masquage, fragmentation, 1009) | Faite par Cloudflare ; le relais refuse > 256 Kio (1009) et le binaire (1003) |
| Boîte aux lettres en mémoire vive (perdue au redémarrage) | **SQLite du Durable Object** : persistante, 24 h, 50 par destinataire, 1000 par salon |
| Minuteries `setInterval` (ping, purge) | Hibernation WebSocket (pas de facturation au repos) ; alarme pour la purge à 24 h |
| Contrôle d'Origin, salon, débit 60 / 10 s, délai HELLO 10 s, 64 clients par salon | Identique ; en plus, **120 ouvertures de connexion par minute et par IP** (limiteur Cloudflare, rien n'est stocké par MESHORA) |
| Journal console | **Aucun** : pas de `console.log`, observabilité et logpush désactivés (`wrangler.jsonc`) |

État conservé par connexion (survit à l'hibernation, ≤ 16 Kio) : salon, défi, clé publique authentifiée, identifiant, nom, compteur de débit.

## Ce que voit le relais (et donc Cloudflare)

Adresses IP, horaires, tailles, clés publiques, noms affichés, codes de groupe. **Jamais le texte** : enveloppes chiffrées de bout en bout (AES-256-GCM, ECDH éphémère). Le courrier en attente est stocké chiffré tel quel, puis effacé à la remise ou après 24 h.

## Coûts (offre gratuite Workers, vérifiée le 26/10/2026)

Source : https://developers.cloudflare.com/durable-objects/platform/pricing/

- Durable Objects SQLite disponibles en offre gratuite : 100 000 requêtes / jour, 13 000 Go-s / jour, 5 M lignes lues, 100 000 lignes écrites / jour, 5 Go stockés.
- Messages WebSocket entrants comptés au ratio 20:1 (100 messages = 5 requêtes) ; un salon au repos hiberne et n'est pas facturé en durée.
- **Plafond de coût : en offre gratuite, un quota dépassé échoue (erreur) au lieu d'être facturé.** Ordre de grandeur : ~2 millions de paquets par jour, soit des centaines d'utilisateurs actifs.
- Passage à l'offre payante (5 $/mois) seulement sur décision.

## Limites connues

1. Un client qui ignore la trame de fermeture garde son TCP ouvert côté Cloudflare ; le relais ne le compte plus (plafond calculé sur les connexions OUVERTES, essai C13).
2. Limiteur par IP approximatif et local à chaque centre Cloudflare (documentation Cloudflare) : protection d'appoint, pas une garantie.
3. Adresse en `*.workers.dev` liée au compte `acousmaticregietools` : stable, mais un nom de domaine MESHORA serait préférable (à décider ; `meshora.org` non utilisé faute de preuve de propriété).
4. Pas de garantie de disponibilité (offre gratuite, pas de SLA).

## Commandes

```bash
cd relay/cloudflare
npx wrangler@4 dev --port 8798            # local
npx wrangler@4 deploy --env=""            # préproduction
cd ../../prototype && RELAY=wss://meshora-relay-preprod.acousmaticregietools.workers.dev npx tsx ../tools/audit/relay-conformance.ts
```
