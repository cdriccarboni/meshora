# Relais de production — conformité du 29 octobre 2026

- Relais : `wss://meshora-relay.acousmaticregietools.workers.dev` (Worker `meshora-relay`, env `production` de `relay/cloudflare/wrangler.jsonc`, offre gratuite : Workers, Durable Objects SQLite, limiteur de débit ; aucun secret).
- Déployé le 29/10/2026 depuis `main` (`dee86c1`) avec wrangler 4.155.0.
- Banc : `tools/audit/relay-conformance.ts`, lancé depuis un Mac (Node), `ORIGIN=https://meshora.pages.dev`.
- Résultat : **13/13**. Test sur ordinateur uniquement : aucun téléphone dans cet essai.

```text
Relais visé : wss://meshora-relay.acousmaticregietools.workers.dev   (série ef26ff)

✅ PASS  C1 — Point de santé /health
         réponse={"status":"ok","service":"meshora-relay","version":"0.3.0","channel":"production","protocol":"v0.2"}
✅ PASS  C2 — Origin non autorisé refusé, Origin du site accepté, salon invalide refusé
         Origin malveillant=403 ; meshora.pages.dev=101 ; salon invalide=400
✅ PASS  C3 — HELLO à signature fausse ou à identifiant usurpé : connexion fermée (1008)
         signature fausse → fermé=true code=1008 ; identifiant usurpé → fermé=true code=1008
✅ PASS  C4 — Pairs : seuls les clients authentifiés, liste à jour après départ
         pairs avec Bob=2 ; après départ de Bob=1 ; liste reçue par un non-authentifié=false
✅ PASS  C5 — Texte en clair non relayé ; enveloppe dont l'expéditeur n'est pas la clé authentifiée non relayée
         clair relayé=false ; enveloppe usurpée relayée=false
✅ PASS  C6 — Courrier différé : non retiré par un imposteur, remis une seule fois au vrai destinataire, puis effacé
         retiré par imposteur=false ; copies reçues par Bob=1 ; recopies à la reconnexion=0
✅ PASS  C7 — Accusé accepté seulement de la clé du destinataire et remis seulement à l'expéditeur
         accusé relayé par un tiers=false ; reçu par l'expéditeur=true ; vu par un tiers=false
✅ PASS  C8 — Limite de débit : > 60 paquets / 10 s → connexion fermée (1008)
         fermé=true code=1008
✅ PASS  C9 — Paquet > 256 Kio (1009) et paquet binaire (1003) : connexion fermée
         300 Kio → fermé=true code=1009 ; binaire → fermé=true code=1003
✅ PASS  C10 — Connexion non authentifiée : trame de fermeture 1008 après le délai (≈ 10 s)
         code=1008 après 10.4 s
✅ PASS  C13 — Salon saturé par 64 connexions anonymes : refus (503), puis place libérée après le délai d'authentification
         connexions ouvertes=64 ; 65ᵉ=503 ; après 11,5 s=101
✅ PASS  C11 — Application web ↔ application web : reçu et « Délivré » (accusé signé)
         reçu=true ; statut=delivered
✅ PASS  C12 — Message envoyé avant l'arrivée du destinataire : remis à sa connexion, puis « Délivré »
         reçu=true ; statut=delivered

RÉSULTAT : 13/13 vérifications réussies contre wss://meshora-relay.acousmaticregietools.workers.dev
```
