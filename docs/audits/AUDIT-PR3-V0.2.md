# Audit indépendant — PR #3 « intégration prototype V0.2 dans /app »

| | |
|---|---|
| Date | 25 octobre 2026 |
| Auditeur | Claude (audit, sécurité, architecture) |
| PR auditée | https://github.com/cdriccarboni/meshora/pull/3 — branche `ai-studio/prototype-v0`, commit `1db8362` |
| Méthode | Lecture du code réel (62 fichiers, 13 997 lignes ajoutées), analyse du `package-lock.json`, `npm audit`, fusion et construction simulées, inspection de l'aperçu déployé. Les tests fournis par la PR ne sont **pas** pris comme preuve. |
| Corrections | En cours par Antigravity. Cet audit ne modifie aucun fichier de `prototype/`. |
| Chemins | Relatifs à `prototype/` sauf mention contraire. Les numéros de ligne correspondent au commit `1db8362`. |

---

## 0. Conclusion

**La V0.2 telle qu'en PR #3 n'est pas suffisamment sûre pour une prévisualisation publique.**

La raison n'est pas l'absence de fonctions réelles, ce qui est normal pour un prototype. Le problème est que l'interface **affirme comme accomplies des choses qui n'ont pas eu lieu** :
- un SOS « émis » vers des nœuds « BLE / LoRa » ;
- des messages « Délivré » alors qu'ils ne sont arrivés nulle part ;
- des alertes « vérifiées » par des signatures fabriquées avec `Math.random()`, dont une attribuée à une mairie ;
- des messages « chiffrés » sans aucune cryptographie.

Pour une application de communication et de continuité, c'est le défaut le plus grave possible : une personne peut agir, ou ne pas agir, sur la foi d'une confirmation fausse.

**Un aperçu contenant ces éléments est déjà accessible publiquement** : `https://4bc420bf.meshora.pages.dev/app/` et l'alias `https://ai-studio-prototype-v0.meshora.pages.dev/app/` (non indexés, mais ouverts à quiconque a le lien). Il a été construit depuis une base antérieure au garde-fou SOS. **Recommandation : supprimer ou remplacer ces déploiements d'aperçu jusqu'à correction des P0.**

**Avant d'annoncer une véritable messagerie mesh**, il manque l'essentiel du produit : identité cryptographique réelle, chiffrement, accusés de réception de bout en bout, et au moins un transport réel entre deux appareils distincts. Les 18 critères sont au §6. Aujourd'hui, **0 sur 18 est rempli**.

### Points positifs constatés
- Le module Shield respecte la règle de vérité : `verifiedRealTunnel` reste `false` sans module natif (`src/shield/ShieldManager.ts:81-93`).
- Un consentement explicite est demandé avant d'utiliser une passerelle tierce (`src/components/screens/GatewaysScreen.tsx:21-30, 80-120`).
- Les stubs Bluetooth, Meshtastic et Reticulum déclarent `isAvailable() === false` et ne sont donc pas utilisés pour l'envoi.
- Aucune vulnérabilité connue dans les 270 dépendances (`npm audit`), toutes sous licence déclarée et compatible avec l'option B.
- Les sons sont synthétisés et la carte est dessinée en code : pas de ressource tierce soumise à droits.
- La PR ne touche qu'à `prototype/` et `.gitignore` : elle n'empiète ni sur le site ni sur la documentation.

---

## 1. Anomalies P0 — sécurité ou mensonge fonctionnel critique

### P0-1 · Le SOS affirme une émission qui n'a pas lieu
- **Fichiers :** `src/components/QuickSOSButton.tsx:278-290` (« ÉMIS »), `:313-326` (badge « BLE / LoRa », `quickSosSent`), `:361` (« Chime sonore & Vibreur activés ») ; `src/core/i18n.ts:189-191` (« Signal de détresse diffusé aux nœuds mesh ! ») et `:414-416` (EN) ; `src/core/resilienceEngine.ts:791-815` (`triggerQuickSOS`).
- **Observé :** l'appui long appelle `sendEmergencyBroadcast`, qui écrit en `localStorage`, poste sur un `BroadcastChannel` (onglets du même navigateur) et appelle `TransportManager.broadcast` (voir P0-3). Aucun transport radio n'existe. L'interface annonce pourtant « ÉMIS » et « diffusé aux nœuds mesh » via « BLE / LoRa ». L'avertissement (`:368-372`) précise seulement que le 112 n'est pas contacté.
- **Correctif attendu :** retirer le bouton de toute version publiée. Le réintroduire seulement quand l'émission est réelle, avec un état honnête : « Préparé — aucun appareil MESHORA à portée n'a confirmé la réception » tant qu'aucun accusé n'est reçu. Afficher en permanence « En danger : appelez le 112 », avec un lien `tel:112`. Validation par le porteur du projet (`docs/tests/EMERGENCY-APPROVAL.md`).
- **Test de validation :** (a) la construction du site échoue tant que le texte SOS est présent sans validation ; c'est vérifié aujourd'hui, voir §5. (b) Après réintroduction : SOS déclenché sur l'appareil A, B à portée et C hors de portée. L'interface de A n'affiche « reçu par 1 appareil » qu'après l'accusé signé de B, puis « aucune confirmation » après extinction de B.

### P0-2 · Signatures fabriquées et marquées « vérifiées »
- **Fichiers :** `src/core/resilienceEngine.ts:554-555` (`postAlert`), `:613-615` (`sendEmergencyBroadcast`), `:765-766` (`simulateNeighborBroadcast`), ainsi que les données initiales `:66-67, 92-93, 116-117, 136, 152, 168, 183, 198, 213, 228` ; `src/core/i18n.ts:167` (« Avis communautaires vérifiés »).
- **Observé :** `signature: 'sig_ed25519_' + Math.random().toString(36)…` et `verified: true` sont écrits en dur. Aucune signature n'est calculée ni vérifiée. Le badge « vérifié » est donc décoratif, ce qui contredit `RESILIENCE.md` §2.2 (« vérifiable ≠ vrai », signature réelle).
- **Correctif attendu :** supprimer les champs `signature` et `verified` fabriqués. `verified` ne peut valoir `true` qu'à l'issue d'une vérification Ed25519 réelle (WebCrypto `Ed25519` ou libsodium) contre la clé d'un émetteur suivi par l'utilisateur. Sinon, afficher « non vérifié ».
- **Test de validation :** test unitaire : une alerte dont un octet du message est modifié doit passer à `verified === false`, ainsi qu'une alerte signée par une clé non suivie. `grep -R "sig_ed25519_' +" src` ne renvoie rien.

### P0-3 · « Délivré » sans destinataire : le WebSocket est toujours « disponible » et réussit toujours
- **Fichiers :** `src/transports/WebSocketTransport.ts:53` (`return this.connected || true`), `:58-67` (`send` renvoie `true` même socket fermée, « Simulation fallback ») ; `src/transports/TransportManager.ts:94-112` (statut `delivered` dès qu'un `send` renvoie `true`) ; `src/components/screens/MessagesScreen.tsx:81` (statut `delivered` dès la création du message).
- **Observé :** dès que `navigator.onLine` est vrai, `dispatched` est toujours `true`, car le WebSocket vers `/ws-mesh-relay` n'existe pas sur Cloudflare Pages et répond quand même « succès ». Tout message passe donc à **« Délivré »**. La notion même de « délivré » est fausse : aucun accusé du destinataire n'existe dans le code (`handleIncomingMessage`, `TransportManager.ts:132-147`, n'envoie rien en retour).
- **Correctif attendu :** `isAvailable()` doit renvoyer `this.connected` (ou `readyState === OPEN`). `send()` doit renvoyer `false` si la socket n'est pas ouverte. Le statut doit suivre `RESILIENCE.md` §3 : `queued` → `handed_to_peer` (le relais a accusé réception) → `delivered` **uniquement** à réception d'un accusé signé du destinataire, référencé par l'identifiant du message.
- **Test de validation :** (a) aperçu Pages sans relais : un message envoyé reste en file (`queued`) et apparaît dans l'Outbox. (b) Deux clients distincts : `delivered` n'apparaît chez A qu'après l'accusé de B ; si B est fermé, A reste sur `handed_to_peer` ou `queued`.

### P0-4 · Perte silencieuse : un message marqué « Délivré » quitte la file d'attente
- **Fichiers :** `src/core/storage.ts:119-125` (le message est retiré de l'Outbox dès que son statut n'est plus `queued`) ; `:104-107, 116-117, 122-124` (erreurs d'écriture `localStorage`, dont le quota dépassé, avalées par `catch {}`) ; `:139-149` (`flushOutbox` marque `relayed` sur la seule foi du retour de `sendFn`) ; `src/transports/TransportManager.ts:119-130` (`flushPendingOutbox` renvoie `true` sans attendre ni vérifier l'envoi).
- **Observé :** combiné à P0-3, un message jamais transmis est marqué « Délivré » et retiré de l'Outbox : il ne sera **jamais renvoyé**. Une saturation du stockage efface aussi des données sans aucun signal. C'est l'inverse de la règle « aucune perte silencieuse » (`RESILIENCE.md` §1).
- **Correctif attendu :** un message ne quitte l'Outbox qu'à réception d'un accusé. Toute erreur d'écriture produit l'état `storage_full` et une notification visible. Passer à IndexedDB, comme annoncé par la documentation mais absent du code (`storage.ts` n'utilise que `localStorage`).
- **Test de validation :** (a) remplir le stockage jusqu'au quota, envoyer un message : notification « Espace presque plein — rien n'a été supprimé », message conservé. (b) Envoyer avec un relais injoignable puis recharger la page : le message est toujours dans l'Outbox.

### P0-5 · « Chiffré » sans chiffrement, identité sans clé
- **Fichiers :** `src/core/identity.ts:12-16, 45-47` (`publicKey = 'ed25519_' + hex` produit par `Math.random()`, empreinte aléatoire) ; `src/components/screens/MessagesScreen.tsx:84` (`encrypted: true`) ; `src/core/i18n.ts:105` (« Écrivez un message (chiffré localement)… »).
- **Observé :** aucune primitive cryptographique n'est utilisée dans tout `src/` (ni `crypto.subtle`, ni bibliothèque). Les messages circulent et sont stockés en clair, y compris les coordonnées GPS. Le libellé et le champ `encrypted: true` affirment le contraire. N'importe quel onglet ou client peut émettre avec n'importe quel `senderId` : l'usurpation est triviale.
- **Correctif attendu :** à court terme, retirer toute mention « chiffré » ou « vérifié » et mettre `encrypted: false`. Ensuite, implémenter `SECURITY.md` §2–3 : clés Ed25519/X25519 générées par WebCrypto (non exportables) ou libsodium, enveloppe signée, chiffrement de bout en bout, vérification par QR.
- **Test de validation :** capture du trafic (relais WebSocket ou `BroadcastChannel`) : aucun texte en clair. Message forgé avec un `senderId` usurpé : rejeté. Empreinte affichée = hachage de la clé publique réelle, identique sur les deux appareils après scan du QR.

### P0-6 · Alertes et conversations fictives présentées comme réelles, dont une attribuée à une mairie
- **Fichiers :** `src/core/resilienceEngine.ts:55-69` (« Mairie / Relais Municipalité », `verified: true`), `:73-121` (« Urgence médicale », blessé à des coordonnées réelles de Paris, « Relayé via BLE / LoRa »), `:705-777` (`simulateNeighborBroadcast`, SOS et blessés générés au hasard, avec sonnerie) ; `src/core/storage.ts:14-50` (messages initiaux « Délivré » de « Relais-Nord-84 » : « Passerelle locale active… ») ; `src/components/screens/MessagesScreen.tsx:90-110` (message simulé « Liaison radio locale établie avec succès », `transport: 'lan'`, `encrypted: true`).
- **Observé :** au premier lancement, l'utilisateur voit des urgences médicales, des points d'eau, une communication municipale et des pairs « vérifiés » qui n'existent pas, sans aucune marque de simulation sur ces éléments. Cela constitue une usurpation d'institution, la possibilité de fausses alertes, et une confusion totale entre démo et réalité.
- **Correctif attendu :** supprimer les données initiales d'urgence. Toute donnée de démonstration doit porter un marquage visible « Exemple » ou « Simulation » (et `simulated: true` dans le modèle), ne jamais utiliser le nom d'une institution réelle ou générique (« Mairie »), ni des coordonnées réelles, ni de sonnerie d'urgence.
- **Test de validation :** profil vierge : aucune alerte ni conversation n'apparaît sans action de l'utilisateur. Les éléments générés par « simuler » portent le badge Simulation, et `grep -Rn "Mairie" src` ne renvoie rien.

### P0-7 · Des pairs inventés affichés comme réellement présents et « vérifiés »
- **Fichiers :** `src/transports/WebSocketTransport.ts:70-88` (« Passerelle Wi-Fi Local (Routeur) », RSSI −42, `verified: true`) ; `src/transports/BroadcastTransport.ts:62-78` (« Voisin Local », RSSI −35, `verified: true`) ; `src/transports/BluetoothLEStub.ts:34-50` ; `src/transports/MeshtasticStub.ts:35+` ; `src/transports/ReticulumStub.ts:35+` ; `src/components/screens/NetworkScreen.tsx:25-85` (RSSI codés en dur) ; `src/components/screens/DevicesScreen.tsx:86-98`.
- **Observé :** `discoverPeers()` renvoie des pairs codés en dur, avec puissance de signal et badge « vérifié ». L'utilisateur croit qu'un routeur, un voisin ou un relais LoRa est à portée.
- **Correctif attendu :** `discoverPeers()` ne renvoie que des pairs réellement observés (message reçu, poignée de main), avec la preuve et l'heure (`Evidence` du contrat `contracts/typescript/meshora-contracts.ts`). Les stubs renvoient `[]`. Les écrans de démonstration portent un marquage « Simulation ».
- **Test de validation :** appareil seul, hors ligne : 0 pair affiché. Un second onglet ou appareil réel connecté : 1 pair, avec l'heure de dernière observation.

### P0-8 · L'aperçu public sert déjà ces contenus
- **Lieu :** `https://4bc420bf.meshora.pages.dev/app/` et `https://ai-studio-prototype-v0.meshora.pages.dev/app/` ; `version.json` = commit `11c2d35`, base antérieure au garde-fou `0c4e259`.
- **Observé :** le bundle JavaScript servi contient « SOS Rapide », « Signal de détresse diffusé aux nœuds mesh ! », « Mairie / Relais Municipalité », 7 occurrences de `sig_ed25519_` et « chiffré localement ».
- **Correctif attendu :** retirer ces déploiements d'aperçu, ou les remplacer par une construction issue d'une base contenant le garde-fou. Ne publier d'aperçu de `/app` qu'à partir d'une branche à jour de `web/public-site`.
- **Test de validation :** `curl -s <aperçu>/app/ | …` ne contient plus ces chaînes, ou l'URL répond 404.

---

## 2. Anomalies P1 — blocage du fonctionnement réel

| Id | Fichier : lignes | Observé | Correctif attendu | Test de validation |
|---|---|---|---|---|
| P1-1 | `src/transports/WebSocketTransport.ts:27` | Le relais est attendu sur `wss://<même hôte>/ws-mesh-relay` ; aucun serveur n'existe dans la PR ni sur Pages. La messagerie entre appareils est donc impossible en ligne. | Décider de l'architecture de relais (§4), la rendre configurable, et désactiver proprement le transport s'il est absent. | Deux appareils distincts échangent via le relais déployé (test M1). |
| P1-2 | `src/transports/BroadcastTransport.ts:44-53` ; `src/core/i18n.ts:106` | `BroadcastChannel` ne relie que des onglets **du même navigateur, même profil, même appareil**. L'interface invite à « tester la messagerie peer-to-peer » avec un 2ᵉ onglet. `send()` renvoie `true` même sans auditeur. `hops + 1` à chaque envoi, sans aucun relais. | Libellé « Test entre onglets de ce navigateur (pas entre appareils) ». Ne pas incrémenter les sauts à l'émission. Ne pas compter ce transport pour « délivré ». | Le libellé est vérifié dans l'interface ; un message envoyé sans 2ᵉ onglet reste en file. |
| P1-3 | `src/core/networkSentinel.ts:25-36` | `navigator.onLine === true` donne « Connecté ». Aucun test de joignabilité réelle, donc un portail captif est vu comme « Connecté ». L'état « Réseau local » n'est jamais calculé, sauf en simulation. | Sonde active vers le relais ou un point de santé, avec preuve horodatée (`RESILIENCE.md` §4). | Wi-Fi avec portail captif : « Internet : non vérifié ». Box débranchée : « Hors ligne » en moins de 60 s. |
| P1-4 | `src/transports/TransportManager.ts:26, 132-137` | La déduplication repose sur un `Set` en mémoire, perdu à chaque rechargement : un même message peut être réaffiché ou rejoué. Aucune validation de schéma des messages entrants (`WebSocketTransport.ts:41`, `BroadcastTransport.ts`), donc n'importe quel objet avec un `id` est accepté et stocké. | Déduplication persistante par identifiant, avec expiration. Validation stricte du schéma, limite de taille, rejet des messages non signés (une fois P0-5 traité). | Rejouer un message après rechargement : il n'est pas réaffiché. Injecter un objet malformé : il est rejeté sans plantage. |
| P1-5 | `index.html:34-40` | Enregistrement du service worker par script **en ligne**, bloqué par la CSP de `/app` (`script-src 'self'`). Le mode hors ligne annoncé ne s'active donc pas en production. | Déplacer l'enregistrement dans `src/main.tsx`. | Sur l'aperçu, `navigator.serviceWorker.controller` est non nul après rechargement, puis l'application s'ouvre en mode avion. |
| P1-6 | `index.html:5` | `maximum-scale=1.0, user-scalable=no` : zoom interdit (WCAG 1.4.4). | Supprimer ces deux paramètres. | Zoom à 200 % possible sur iPhone et Android. |
| P1-7 | `index.html:27-29` | Google Fonts chargé : la feuille est bloquée par la CSP, mais le `preconnect` ouvre une connexion vers Google (fuite d'adresse IP, contraire à `PUBLICATION.md` §6). | Polices auto-hébergées ou police système ; retirer les `preconnect`. | Onglet Réseau : aucune requête vers un domaine tiers. |
| P1-8 | `src/components/QuickSOSButton.tsx:69-92` | Géolocalisation demandée **au moment** du SOS, sans écran d'explication préalable. Position stockée et diffusée en clair (P0-5). Conversion vers la « grille » codée pour Paris (`:86-87`, `- 2.34`, `48.865`), donc fausse ailleurs. | Permission demandée hors urgence, avec explication et possibilité de refus ; position jamais diffusée sans consentement explicite par envoi ; suppression de la conversion spécifique à Paris. | Refus de la permission : l'application fonctionne et n'envoie aucune position. |
| P1-9 | `src/core/resilienceEngine.ts:24-31` (fiche « Premiers secours ») | « 112 fonctionne sans carte SIM sur tout réseau » : **à ma connaissance faux en France**, où les appels d'urgence sans SIM ne sont plus acheminés [à vérifier auprès d'une source officielle]. La réanimation omet l'appel aux secours et le défibrillateur. | Faire relire les fiches par une source qualifiée (Croix-Rouge, Protection civile, Service-public.fr), citer la source et la date, ou retirer les fiches. | Chaque fiche porte une source vérifiable et une date de relecture. |
| P1-10 | `src/core/resilienceEngine.ts:36-41` | Fiche radio : LoRa Meshtastic « LongFast » indiqué à 868,250 MHz en Europe ; la valeur par défaut est à ma connaissance 869,525 MHz [à vérifier dans la documentation Meshtastic]. | Vérifier et citer la documentation Meshtastic. | Valeur conforme à la documentation officielle. |
| P1-11 | `public/manifest.json` (icônes) ; `index.html:24` | Icônes en SVG uniquement (iOS exige du PNG) ; `apple-touch-icon.png` référencé mais absent ; `theme-color` `#090a0c` ≠ manifeste `#121316`. | Réutiliser `site/assets/icons/` (PNG 180, 192, 512, maskable) ; une seule couleur. | Installation sur iPhone et Android : icône correcte. |
| P1-12 | `tests/mesh.test.ts:88-100, 179-223, 285+` | Les tests 5, 9 et 11 sont **tautologiques** : le test 5 réussit si l'API existe (toujours vrai en ligne de commande) ; le test 9 appelle lui-même `relayEmergencyBroadcast` puis vérifie un compteur local, et son rapport affirme « relayée sur le mesh local » ; le test 11 vérifie une signature fabriquée. | Renommer en tests unitaires de l'état local, sans affirmation de transport. Ajouter de vrais tests à deux clients (Playwright, deux contextes de navigateur distincts) et des tests négatifs (falsification, rejeu). | Le rapport de tests ne contient plus « réel », « relayée sur le mesh » ni « émise avec succès » pour des tests purement locaux. |

---

## 3. Anomalies P2 — améliorations

| Id | Fichier : lignes | Observé | Correctif attendu |
|---|---|---|---|
| P2-1 | `package.json` ; `metadata.json` ; `.env.example` | `@google/genai`, `express` et `dotenv` déclarés mais **jamais importés**. `@google/genai` est le seul paquet avec script d'installation (et tire `protobufjs`). `metadata.json` déclare `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`. `.env.example` réclame une `GEMINI_API_KEY`. | Retirer les trois dépendances, la capacité Gemini et la variable, conformément à la promesse « aucune donnée envoyée à un service IA ». |
| P2-2 | `.aistudio/artifacts/brain/…/implementation_plan.md` | Artefacts internes de l'outil AI Studio versionnés. Ils ne contiennent pas de secret, mais ce n'est pas du code du projet et ils promettent des fonctions non réalisées (« accusés de réception », « signées cryptographiquement »). | Retirer du dépôt, ou déplacer en documentation explicitement « plan, non réalisé ». |
| P2-3 | `src/components/EmergencyBroadcastPanel.tsx:240-247` | Stroboscope plein écran rouge/blanc toutes les 280 ms : sous le seuil général des 3 flashs par seconde, mais l'alternance de rouge saturé en plein écran présente un risque photosensible, sans aucun avertissement. Le vocabulaire est contraire à `DESIGN.md`. | Avertissement préalable, couleurs non saturées, ou retrait de la fonction. |
| P2-4 | `src/components/EmergencyBroadcastPanel.tsx:304-310` ; `src/core/i18n.ts:182` | L'avertissement affirme « Ces alertes sont diffusées de pair-à-pair entre utilisateurs proches », ce qui est faux aujourd'hui. Le bouton « Relayer l'alerte (+1 saut) » n'incrémente qu'un compteur local. | Formulation au conditionnel ou retrait, tant que P0-1 n'est pas résolu. |
| P2-5 | `src/core/i18n.ts:85, 90, 95` | « zéro message perdu », « garantir que vos échanges restent toujours accessibles », « Liaisons actives détectées » (alimenté par des pairs fictifs). | Reformuler sans garantie absolue (`DESIGN.md` §7–8). |
| P2-6 | `src/shield/ShieldManager.ts:86-88` | Avec Shield « activé », l'écran affiche « Protection d'isolation locale active » et un point d'accès `wg0.meshora.local:51820`, sans aucune protection réelle. | « Protection non disponible dans le navigateur » ; aucun point d'accès fictif. |
| P2-7 | `public/sw.js:2` | Nom de cache fixe `meshora-app-v0.2.0` : risque de servir une ancienne version après mise à jour. | Nom dérivé du hachage de construction, et invitation « Nouvelle version disponible » (`PUBLICATION.md` §4). |
| P2-8 | `src/components/QuickSOSButton.tsx:284, 361, 385, 393` | Textes français codés en dur (« ÉMIS », « Chime sonore… », « Ma Balise SOS Déclenchée », « Localiser sur la carte locale ») qui contournent l'i18n. | Passer par `i18n.ts`. |
| P2-9 | `src/core/resilienceEngine.ts` (carte et repères) | Carte schématique fictive avec repères « Poste de premiers secours », « Borne d'eau », « Gymnase refuge » et coordonnées réelles de Paris, sans mention « exemple ». | Marquer « carte d'exemple » ; aucune coordonnée réelle. |

---

## 4. Relais Cloudflare (solution impliquée par le code)

Aucun plan de relais n'a été trouvé dans la PR ni sur GitHub. Le code attend un relais WebSocket sur le **même hôte**, à `/ws-mesh-relay` (`WebSocketTransport.ts:27`). Sur Cloudflare, cela implique un **Worker avec Durable Object** (Pages seul ne tient pas de WebSocket). Cette évaluation porte donc sur cette architecture. Antigravity est invité à publier son plan réel dans `docs/` pour revue.

| Sujet | Constat | Exigence |
|---|---|---|
| Limites gratuites | Durable Objects gratuits : 100 000 requêtes par jour, 13 000 GB·s de durée par jour, 5 Go de stockage SQLite ; au-delà, **les opérations échouent** (pas de facturation automatique). Chaque message WebSocket entrant compte pour 1/20 de requête ; une connexion compte pour 1. Workers gratuits : 100 000 requêtes par jour, 10 ms de CPU par invocation. Offre payante : 5 $ par mois minimum. [Sources : documentation Cloudflare, voir §8] | Utiliser obligatoirement l'**API d'hibernation WebSocket**, sinon toute la durée de connexion est facturée et le quota de durée s'épuise vite. Surveiller les quotas ; afficher « relais indisponible » plutôt qu'un faux « délivré » quand le quota est atteint. |
| Ce que voit le relais | Aujourd'hui, les messages sont en clair (P0-5) : un relais Cloudflare verrait tout le contenu, les coordonnées GPS et les identités. | **Aucun relais public avant le chiffrement de bout en bout.** Le relais ne doit voir que des enveloppes chiffrées (`ARCHITECTURE.md` ADR-3). |
| Abus | Sans authentification, n'importe qui peut se connecter, inonder le relais (épuisement du quota pour tous) ou usurper un `senderId`. | Enveloppes signées, quotas par clé et par IP, taille maximale des messages, liste d'origines autorisées (`Origin`), Cloudflare Rate Limiting. |
| Journaux | Les Workers peuvent journaliser le contenu des messages. | Aucun journal de contenu ; métadonnées minimales ; durée de conservation documentée (`PUBLICATION.md` §6). |
| Positionnement | Un relais Internet n'est pas un « mesh » : sans Internet, il ne sert à rien. | Le présenter comme « MESHORA Connect — relais Internet », jamais comme maillage local. À terme, privilégier Nostr (relais remplaçables et auto-hébergeables, `ARCHITECTURE.md` ADR-7) plutôt qu'un relais propriétaire unique. |
| Exploitation | Un Worker exige un déploiement séparé de Pages (`wrangler.toml`, binding Durable Object), une surveillance et une procédure en cas d'abus. | Projet Worker distinct, documenté, sous le même compte ; pas de second projet Pages. |

---

## 5. GitHub : état de la PR #3 et cohérence avec les PR #1 et #2

| Vérification | Résultat |
|---|---|
| État | Ouverte, non brouillon, 1 commit (`1db8362`), 62 fichiers, base `web/public-site` |
| Fusionnabilité (GitHub) | `MERGEABLE`, `CLEAN` |
| Base | `11c2d35` — **antérieure** à `0c4e259` (logo officiel et garde-fou SOS) et à `722217e` (rapport de tests). La PR ne contient donc ni le garde-fou, ni le logo harmonisé du site. |
| Fusion simulée dans `web/public-site` (`722217e`) | Fusion **sans conflit** (seuls `prototype/` et `.gitignore` sont touchés). `npm ci --ignore-scripts` OK, `vite build` OK (383 ms). |
| Construction du site après fusion | **ÉCHEC, comme attendu** : « Fonction de détresse « SOS » dans /app (app/assets/index-….js) sans validation ». Le garde-fou empêche toute publication de cette version. |
| Cohérence avec la PR #1 (documentation) | Contraire à `RESILIENCE.md` §1–4 (aucune perte silencieuse, aucun affichage trompeur), `SECURITY.md` §2–4, `DESIGN.md` §7–8, `PUBLICATION.md` §3 (règles 2, 3, 6) et §7 (critère M1). |
| Cohérence avec la PR #2 (site) | Le site dit « les messages ne sont pas encore réellement envoyés » ; l'application dit « Délivré ». Les deux ne peuvent pas être publiés ensemble en l'état. |
| Intégration Cloudflare | `prototype/dist` n'est pas versionné, ce qui est correct. Mais aucune configuration ne construit le prototype sur Cloudflare (la commande de construction actuelle n'exécute pas `npm ci && npm run build` dans `prototype/`) : l'aperçu `4bc420bf` a été construit localement. |

---

## 6. Licences et dépendances (option B provisoire)

| Vérification | Résultat |
|---|---|
| Licence du prototype | AGPL-3.0-or-later (`LICENSE`, en-têtes SPDX) — cohérent avec l'option B |
| `package-lock.json` | Version 3, 270 paquets, tous issus de `registry.npmjs.org`, **tous avec une licence déclarée** |
| Répartition | MIT 194 · Apache-2.0 30 · MPL-2.0 24 · BSD-3-Clause 13 · ISC 6 · BSD-2-Clause 1 · 0BSD 1 · CC-BY-4.0 1 |
| Points d'attention | MPL-2.0 : uniquement `lightningcss` (outil de construction, non embarqué), compatible de toute façon. CC-BY-4.0 : `caniuse-lite` (données de construction, non embarquées). |
| Vulnérabilités | `npm audit --package-lock-only` : **0** (aucune faible, modérée, élevée ni critique) |
| Scripts d'installation | `@google/genai` (inutilisé, voir P2-1), `esbuild`, `fsevents`, `protobufjs` (tiré par `@google/genai`) |
| Obsolète | `node-domexception` (signalé obsolète par npm, dépendance indirecte) |
| Ressources | Sons synthétisés (Web Audio), carte dessinée en SVG : aucune ressource tierce. Aucun fichier image ou audio ajouté. |
| Reste à faire (LICENSING.md §7) | L1 rempli par cet audit pour les licences ; L2 rempli pour sons et cartes ; L3 (titularité des contenus générés) reste au porteur du projet |

---

## 7. Critères pour déclarer la messagerie réellement opérationnelle

La messagerie ne peut être annoncée comme opérationnelle que lorsque **tous** les critères ci-dessous sont remplis, chacun avec un rapport archivé dans `docs/tests/`. Ils précisent et complètent le critère M1 (`PUBLICATION.md` §7).

**Identité et sécurité**
1. Clés générées sur l'appareil par une bibliothèque éprouvée (WebCrypto ou libsodium), clé privée non exportable ou stockée chiffrée.
2. Vérification d'un contact par QR ou empreinte, identique sur les deux appareils.
3. Chaque message est signé ; un message altéré, rejoué ou usurpé est rejeté (tests négatifs automatisés).
4. Le contenu est chiffré de bout en bout ; une capture du trafic sur le relais ne montre aucun texte en clair ni aucune coordonnée.
5. Aucun champ `verified`, `encrypted` ou `signature` n'est écrit en dur dans le code (vérification automatique en CI).

**Transmission réelle**
6. Deux clients **distincts** (deux appareils physiques, ou au minimum deux navigateurs ou profils différents) échangent dans les deux sens par un transport réel, sans état partagé.
7. Le statut « Délivré » n'apparaît qu'après un accusé signé du destinataire, référencé par l'identifiant du message.
8. Destinataire hors ligne : le message reste « En attente » chez l'expéditeur, puis passe à « Délivré » après la reconnexion du destinataire, sans doublon.
9. Expiration sans accusé : l'expéditeur reçoit une notification « Pas encore reçu — renvoyer ? ».
10. Relais indisponible ou quota épuisé : aucun faux succès ; le message reste en file.

**Persistance et résilience**
11. Rechargement, fermeture ou redémarrage : aucun message non accusé n'est perdu.
12. Stockage plein : notification, aucune suppression silencieuse.
13. Déduplication persistante : aucun message réaffiché après rechargement ou rejeu.
14. Détection de connexion par sonde réelle ; portail captif correctement signalé.

**Plateformes et interface**
15. Testé sur Android (Chrome) et iPhone (Safari et PWA installée), avec les limites d'arrière-plan documentées et affichées.
16. Aucun pair, alerte ou message fictif sans marquage « Simulation » visible.
17. Aucune fonction SOS ou détresse publiée sans `docs/tests/EMERGENCY-APPROVAL.md` signé par le porteur du projet, après un test réel à plusieurs appareils.

**Revue**
18. Revue de sécurité du code de messagerie par Claude, sans point P0 ou P1 ouvert ; audit externe programmé avant tout lancement public (`SHIELD-SECURITY-AUDIT.md` §9.2).

**État au 25 octobre 2026 : 0 critère sur 18 rempli.**

Même une fois ces critères remplis, il s'agira d'une **messagerie via relais Internet**. Le mot « mesh » (sans Internet, entre appareils proches) exigera en plus les tests de la phase 0 sur appareils natifs : E2, E3, E4 et E10 (`ROADMAP.md`). Une PWA ne peut pas faire de Bluetooth sur iPhone.

---

## 8. Compatibilité (rappel des limites)

| Fonction | PWA navigateur | Android natif | iPhone natif |
|---|---|---|---|
| BroadcastChannel | Onglets du **même navigateur** seulement | — | — |
| Relais WebSocket | Oui, si un relais existe et qu'Internet ou le LAN est disponible | Oui | Oui |
| Bluetooth LE entre téléphones | Non (aucune émission d'annonces BLE en web ; pas de Web Bluetooth sur iOS) | Oui (natif) | Oui au premier plan ; limité en arrière-plan |
| Arrière-plan | Suspendu | Service au premier plan | Très limité |
| Meshtastic / Reticulum | Web Serial sur Chrome desktop/Android uniquement | Oui | Via radio compagnon BLE (natif) |

Sources : documentation Cloudflare — tarifs Durable Objects (https://developers.cloudflare.com/durable-objects/platform/pricing) et Workers (https://developers.cloudflare.com/workers/platform/pricing/) ; analyses de compatibilité : `AUDIT.md`, `COMPATIBILITY.md`, `NEARBY.md`.
