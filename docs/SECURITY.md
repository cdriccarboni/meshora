# MESHORA — Modèle de sécurité

> Version 0.1 — 25 octobre 2026. Statut : **proposition, non auditée.** Règle absolue : aucune primitive cryptographique écrite par l'équipe ; uniquement libsodium, le Noise Protocol Framework et, plus tard, MLS (RFC 9420).

## 1. Ce que MESHORA protège, et ce qu'il ne protège pas

| Protégé | Non protégé (à dire aux utilisateurs) |
|---|---|
| Contenu des messages privés (chiffré de bout en bout) | Le fait qu'un appareil émet en Bluetooth/LoRa à un endroit donné (radiogoniométrie) |
| Authenticité de l'émetteur (signature) | La disponibilité : un brouilleur radio coupe tout |
| Intégrité (toute modification est détectée) | Les métadonnées de volume et d'horaires face à un observateur radio patient |
| Non-réutilisation des clés de session (confidentialité persistante sur les liens directs) | Un téléphone déverrouillé saisi |
| | Les messages **publics** (canaux ouverts, publications Mastodon/Bluesky) |

## 2. Identités

- **Clé racine utilisateur** : Ed25519, générée sur l'appareil, jamais transmise. Sauvegarde chiffrée par phrase de récupération (BIP-39 ou équivalent) [C].
- **Clés d'appareil** : une par appareil, certifiée par la clé racine (attestation signée, révocable). Perdre un téléphone ⇒ révoquer sa clé sans changer d'identité.
- **Identifiant affiché** : empreinte courte de la clé racine + surnom local. Les surnoms ne sont **jamais** une preuve d'identité (leçon de la faille d'usurpation de Bitchat en bêta [S]).
- **Vérification** : QR code en face à face ou comparaison de nombres de sécurité. Statut « vérifié / non vérifié » visible en permanence.
- **Liaison Nostr** : clé secp256k1 distincte, liée par attestation signée des deux côtés.

## 3. Chiffrement

| Usage | Mécanisme |
|---|---|
| Lien direct entre deux voisins (BLE, LAN) | Noise XX (X25519, ChaCha20-Poly1305, BLAKE2s) — authentifie les deux clés d'appareil, confidentialité persistante |
| Message privé en stockage-relais (multi-sauts, différé) | Chiffrement anonyme vers la clé du destinataire (X25519 éphémère + XChaCha20-Poly1305), signature Ed25519 de l'émetteur **à l'intérieur** du chiffré : les relais ne voient pas qui écrit |
| Groupes (MVP, < 50 membres) | Clé de groupe par émetteur (« sender keys ») renouvelée à chaque départ de membre |
| Groupes (stable) | MLS (RFC 9420) |
| Via Internet | Enveloppe MESHORA encapsulée dans un événement Nostr NIP-59 (« gift wrap ») [C] |
| Au repos sur l'appareil | Base SQLite chiffrée, clé dans le trousseau système (Keychain / Android Keystore) |

## 4. Protection contre les relais malveillants

| Attaque | Contre-mesure |
|---|---|
| Lire les messages | Chiffrement de bout en bout ; le relais ne voit qu'une étiquette de destinataire |
| Identifier le destinataire | Étiquette de destinataire **rotative** (dérivée de la clé du destinataire et d'une fenêtre de temps), pas sa clé publique |
| Modifier un message | Signature + AEAD : rejet |
| Rejouer un message ancien | Identifiant unique + date d'expiration + cache de dédup |
| Gonfler le compteur de sauts / boucler | `ttl_hops` plafonné à 7, décrémenté par chaque nœud, inclus dans un champ non signé mais borné ; les nœuds ignorent toute valeur > 7 |
| Inonder le réseau (spam, déni de service) | Quotas par voisin et par émetteur, priorité aux contacts vérifiés, preuve de travail légère optionnelle sur les canaux publics |
| Sybil (mille fausses identités) | Les identités non vérifiées ont des quotas faibles ; les canaux publics sont modérables localement |
| Avaler les messages (trou noir) | Inondation multi-chemins + accusés de bout en bout ; réémission par d'autres voisins |
| Pister un appareil par son Bluetooth | Adresse BLE aléatoire du système + identifiant d'annonce MESHORA éphémère, renouvelé (≤ 15 min) |
| Passerelle malveillante | Elle ne voit que du chiffré ; elle peut retarder ou jeter → multi-passerelles et multi-relais Nostr |
| Passerelle de publication sociale | Seule une passerelle détenant **le jeton délégué de l'utilisateur** publie ; jamais de jetons sur des passerelles publiques |
| Mise à jour piégée | Versions signées, builds reproductibles visés en phase stable |

## 5. Points ouverts à trancher avant la bêta

1. Étiquette de destinataire rotative : coût de calcul pour le destinataire qui doit tester chaque message reçu (à mesurer sur ESP32 et téléphone d'entrée de gamme).
2. Révocation de clé d'appareil en mode hors ligne : propagation et délai acceptable.
3. Canaux publics : modération locale, signalement, listes de blocage partagées ?
4. Sauvegarde et restauration de l'historique sans serveur.
5. **Audit externe obligatoire avant la version stable** (OSTIF, Radically Open Security, ou équivalent) ; budget en ROADMAP.

## 6. Engagements de communication

- Ne jamais écrire « anonyme », « intraçable » ni « fonctionne en toute situation d'urgence ».
- Afficher l'état réel : « chiffré, contact vérifié », « chiffré, contact non vérifié », « public ».
- Publier ce modèle de menace avec l'application.
