# Bluetooth LE MESHORA V0.3 — revue, plan d'essais physiques, confidentialité

> Statut : **expérimental, jamais testé entre deux téléphones réels.** Désactivé par défaut ; activé seulement par l'utilisateur (Réseau → Bluetooth). La messagerie par Internet (relais de référence) ne dépend pas du Bluetooth.

## 1. Revue du code (PR #10, `BleMesh.kt`, `MeshRouter.kt`, `RelayPolicy.kt`)

| Point | Constat | Statut |
|---|---|---|
| Autorisations | Android 12+ : `BLUETOOTH_SCAN` (`neverForLocation`), `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT` ; ≤ 11 : `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE_LOCATION`. V0.3 : demandées **à l'activation** du Bluetooth, plus au démarrage | ✅ |
| Annonce radio | `setIncludeDeviceName(false)` ; seul l'UUID de service 128 bits est annoncé ; adresse MAC aléatoire gérée par Android | ✅ |
| Annonce MESHORA (trame ANNOUNCE) | V0.3 (27/10) : **scellée par la clé du groupe** — nom et clé publique invisibles hors du groupe (§3) | ✅ testé en JVM (espion radio, `MeshRouterTest`) |
| Enveloppes et accusés sur le maillage | V0.3 (27/10) : scellés aussi ; type, taille exacte (arrondie à 128 octets) et clés invisibles hors du groupe ; identifiants de trame dérivés par HMAC, changent chaque jour | ✅ testé en JVM + vecteurs Python/Kotlin/TypeScript |
| Relais multi-sauts | TTL 7, plafonné à 5 si ≥ 6 voisins ; déduplication par identifiant ; limiteur par pair ; réassemblage 30 s / 64 Kio / 64 en parallèle | ✅ testé en JVM (MeshRouterTest, 3 nœuds) |
| Accusés par le maillage | Accusé v2 signé, relayé avec identifiant dérivé de la signature ; validé comme par Internet | ✅ testé en JVM |
| Arrière-plan | Service de premier plan déclaré (`connectedDevice`) mais le maillage ne fonctionne qu'application ouverte | ⚠️ §4 |
| Consommation | Non mesurée | ❓ essai P5 |

## 2. Plan d'essais physiques (à faire avec de vrais téléphones)

Matériel minimal : 2 Android (dont le Pixel 9), idéalement 3 ; APK `0.3.0-beta1` ou suivante ; Internet coupé (mode avion puis Bluetooth seul) pour P1–P4.

| Essai | Procédure | Mesure / critère de réussite |
|---|---|---|
| P1 Découverte | A et B à 1 m, Bluetooth activé dans les deux applications | B apparaît dans Contacts → « Connectés maintenant » via Bluetooth en < 30 s |
| P2 Message direct | A écrit à B (contact vérifié par invitation au préalable) | Reçu par B ; ✓✓ « Délivré » chez A |
| P3 Portée | Répéter P2 à 5, 10, 20, 40 m (intérieur, puis extérieur) | Distance maximale avec 5/5 messages délivrés |
| P4 Relais 2 sauts | A — C — B, A et B hors de portée l'un de l'autre (vérifier par P1 qu'ils ne se voient pas) | Message A→B délivré via C ; accusé revenu chez A |
| P5 Batterie | Même téléphone, 2 h écran allumé, Bluetooth MESHORA actif puis inactif | Écart de % de batterie |
| P6 Rafale | 50 messages A→B en 1 min | Taux de remise, aucun plantage |
| P7 Écoute passive | Application nRF Connect sur un 3ᵉ téléphone | Ce qui est lisible en clair (doit correspondre au §1) |

Résultats à consigner dans `docs/tests/` : modèles, versions d'Android, distances, captures. Tant que P1–P4 ne sont pas réussis, le site et l'application gardent la mention « expérimental ».

## 3. Identifiants tournants — implémenté le 27/10/2026 (non testé sur téléphone)

**Problème.** Un observateur radio (simple téléphone) peut associer la clé publique permanente et le nom affiché à une présence physique, et suivre la personne. Bitchat a le même défaut (identifiant de pair non rotatif, voir `docs/audits/CONTRE-AUDIT-REA-BITCHAT.md`, B-P0-3).

**Implémenté (V0.3, `mesh/GroupSeal.kt`, `prototype/src/mesh/groupSeal.ts`) : trames chiffrées par le groupe.** Vecteurs communs produits par une implémentation Python indépendante (`tools/audit/group-seal-reference.py`, `docs/tests/v0.3/group-seal-vectors.json`).
1. Clé de groupe : `kg = HKDF-SHA256(code du groupe, sel = "MESHORA-BLE-v1", info = jour UTC)` — change chaque jour ; le code de groupe (60 bits aléatoires) n'est connu que des membres invités.
2. Toute trame MESHORA sur le Bluetooth (ANNOUNCE, ENVELOPE, ACK) est chiffrée AES-256-GCM avec `kg` ; l'identifiant de trame devient aléatoire par trame.
3. Un étranger au groupe ne voit que des octets aléatoires de taille arrondie (rembourrage à 256 octets).
4. **Non retenu pour l'instant** : rotation de l'UUID de service par groupe. Elle empêcherait les téléphones d'autres groupes de relayer les trames. L'UUID fixe révèle seulement « un appareil MESHORA est proche » ; l'adresse radio (MAC) est aléatoire et changée par Android.
5. Ce qui reste visible : la présence d'un appareil MESHORA, la puissance du signal, le TTL (une annonce part avec un TTL de 2), les horaires.

Conséquence : un téléphone ne **découvre** et ne **lit** que les membres de son groupe, mais **relaie** les trames scellées de tous les groupes sans pouvoir les lire (testé : relais d'un autre groupe dans `MeshRouterTest`).

## 4. Arrière-plan (évolution)

Aujourd'hui : maillage actif application ouverte. Étape suivante : service de premier plan avec notification permanente « MESHORA relaie à proximité », balayage à faible consommation (`SCAN_MODE_LOW_POWER`), arrêt automatique sous 15 % de batterie. À n'activer qu'après les mesures P5.
