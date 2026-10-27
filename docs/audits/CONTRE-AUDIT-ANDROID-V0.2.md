# Contre-audit — application Android native V0.2 (PR #7)

| | |
|---|---|
| Date | 26 octobre 2026 |
| Auteur | Claude (contre-audit, intégration, validation) |
| Code audité | `android/native-beta` @ `f990e03` (Antigravity), PR #7 |
| Branche de corrections | `claude/android-interop` = branche de validation V0.2 (PR #5) + `f990e03` (fusion sans conflit) + corrections |
| Environnement | Mac M4, JDK 17 (Homebrew), Android SDK 35/36, Gradle 8.11.1, AGP 8.7.3, Node 24 |
| Publication | **Aucune.** Rien n'est envoyé sur Google Play, rien n'est fusionné. |

## 0. Verdict

L'application est une vraie application **Kotlin + Jetpack Compose**, sans WebView ni PWA encapsulée : vérifié dans les sources et dans l'APK. La cryptographie Kotlin est compatible avec celle du web (P-256, AES-256-GCM, signatures IEEE P1363, mêmes chaînes signées). Les 7 tests d'Antigravity passent.

Mais, à `f990e03` :

| Id | Gravité | Constat | Statut sur `claude/android-interop` |
|---|---|---|---|
| A-P0-1 | **P0 sécurité** | La clé de signature de publication `android/meshora-upload.jks` est **versionnée sur GitHub**, avec son mot de passe **en clair** dans `build.gradle.kts` (valeur par défaut). | Retirée du dépôt (l'historique n'est pas réécrit : elle reste lisible dans `f990e03`). Mot de passe par défaut supprimé. Signature lue hors dépôt (`~/.meshora/signing.properties`). **Cette clé doit être considérée comme compromise et ne jamais être enregistrée comme clé d'importation Play.** |
| A-P0-2 | **P0 fonctionnel** | Le client WebSocket Android parle un protocole inventé (`register`, `message`, `ack`, `welcome`, `peer_joined`) qu'**aucun relais MESHORA ne comprend**, ni l'ancien ni le durci. La « messagerie WebSocket réelle » annoncée n'a jamais pu fonctionner. | Corrigé : protocole MESHORA (défi signé, `MESHORA_HELLO/PEERS/ENVELOPE/ACK`), identique au web. **Interopérabilité démontrée** (§2). |
| A-P0-3 | **P0 honnêteté** | `MeshoraBleManager.startScan()` / `startAdvertising()` n'appellent **aucune** API Bluetooth mais affichent « Balayage BLE actif » / « Annonce périphérique BLE active ». | Corrigé : état « non implémenté dans cette version ». |
| A-P0-4 | **P0 sécurité** | « Délivré » accordé sur **tout** accusé signé valide, même signé par un tiers avec sa propre clé (même faille que T3/T4 côté web). | Corrigé : l'accusé doit être signé par la clé à laquelle le message a été chiffré (test `TransportManagerAckTest`). |
| A-P1-1 | P1 Play | `targetSdk = 35` : refusé par Google Play pour toute nouvelle soumission depuis le 31 août 2026 (API 36 exigée). | Corrigé : `compileSdk`/`targetSdk` 36. AGP 8.7.3 avertit sur le SDK 36 : mise à jour d'AGP recommandée. |
| A-P1-2 | P1 Play | Fonctionnalités implicites `android.hardware.bluetooth` et `android.hardware.location` **requises** (permissions) : appareils sans ces capteurs exclus. | Corrigé : `required="false"`. |
| A-P1-3 | P1 | Outbox renvoyée seulement sur appel manuel ; un accusé perdu n'était jamais réémis. | Corrigé : renvoi à l'authentification, à l'arrivée d'un pair, toutes les 15 s ; accusé réémis sur doublon. |
| A-P1-4 | P1 | Version de publication signée silencieusement avec la clé de **débogage** si le keystore manque. | Corrigé : version non signée sans configuration. |
| A-P1-5 | P1 | Clé privée d'identité en clair dans `SharedPreferences` (exclue des sauvegardes, c'est bien). | **Non corrigé** : migrer vers Android Keystore (clé non extractible) — à Antigravity. **Mise à jour 27/10/2026 : corrigé en V0.3** (`SecureKeyBox`, clé AES du magasin de clés). |
| A-P1-6 | P1 | Messages stockés **en clair** dans `SharedPreferences`, alors que la fiche Play affirme « Données chiffrées stockées » et la politique « chiffrés localement ». | **Non corrigé** : chiffrer le stockage (clé Keystore) ou corriger les textes. **Mise à jour 27/10/2026 : corrigé sur `claude/v0.4-prekeys`** (`LocalVault` : messages, identifiants vus et contacts chiffrés ; migration de l'ancien clair ; réglages, prékeys et coffre exclus des sauvegardes). |
| A-P1-7 | P1 | UUID Bluetooth 16 bits `0xFE60/61/62` présentés comme « service standardisé MESHORA » : la plage 0xFDxx–0xFExx est attribuée par le Bluetooth SIG à des entreprises membres ; MESHORA n'en a pas. | **Non corrigé** (aucun code BLE actif) : utiliser un UUID 128 bits aléatoire avant tout essai radio. **Mise à jour 27/10/2026 : corrigé** (V0.3 : `MeshIds` 128 bits ; V0.4 : derniers UUID 0xFE6x retirés du code hérité). |
| A-P1-8 | P1 Play | Permissions déclarées pour des fonctions absentes (BLE, `FOREGROUND_SERVICE_CONNECTED_DEVICE`, notifications) : déclarations Play (service de premier plan, sécurité des données) difficiles à justifier. | **Non corrigé** : retirer jusqu'à l'implémentation réelle du BLE. **Mise à jour 27/10/2026 :** le Bluetooth existe depuis V0.3 (permissions BLE justifiées), mais le service de premier plan `MeshoraBleService` n'était jamais démarré. **Décision du directeur artistique (27/10/2026) : le démarrer pendant le maillage** (« le principe est de pouvoir communiquer, pas d'économiser la batterie »). Corrigé sur `claude/v0.4-prekeys` : service `connectedDevice` + verrou de veille partiel tant que le Bluetooth MESHORA est activé, notification avec bouton Arrêter ; permissions désormais toutes utilisées. |
| A-P2-1 | P2 | Fiche Play : `support@meshora.org`, `meshora.org/privacy` — domaine non vérifié comme appartenant au projet. | À valider par le directeur artistique. |
| A-P2-2 | P2 | Guide de bêta fermée : renvoie au keystore du dépôt ; omet l'exigence « 12 testeurs pendant 14 jours consécutifs » pour les comptes personnels créés après le 13/11/2023. | À corriger par Antigravity. |
| A-P2-3 | P2 | L'utilisateur doit saisir la clé publique hexadécimale du destinataire si aucun pair n'est listé ; pas de QR. | Feuille de route (vérification de clé par QR). |

## 1. Corrections apportées (commits `0e2b338`, `68e7822`)

- `transport/WebSocketTransport.kt` : protocole MESHORA ; état `AUTHENTICATED` ; identifiant `msh_` dérivé de la clé et vérifié pour chaque pair ; aucun message en clair.
- `transport/TransportManager.kt` : identité injectée (testable sur JVM), règle « Délivré » liée au destinataire, accusé réémis, Outbox renvoyée automatiquement.
- `transport/ble/MeshoraBleManager.kt` : états honnêtes.
- `app/build.gradle.kts` : signature hors dépôt, plus de repli débogage, API 36, variables d'essai d'interopérabilité.
- `AndroidManifest.xml` : Bluetooth et localisation non requis.
- `.gitignore` : `*.jks`, `*.keystore`, `signing.properties`, sorties de compilation.

## 2. Preuves

| Essai | Commande | Résultat |
|---|---|---|
| Tests unitaires d'Antigravity | `./gradlew testDebugUnitTest` | 7/7 (reproduit à `f990e03`) |
| Tests après corrections | idem | `CryptoEngineTest` 5/5, `OutboxRepositoryTest` 2/2, `TransportManagerAckTest` 3/3 |
| **Interopérabilité Android ↔ web, relais local** | `bash tools/audit/interop-android.sh` | `LiveRelayInteropTest` 1/1 : code Kotlin de l'app (JVM) ↔ **vrai code web** (robot d'écho) : Android→web reçu et « Délivré » sur accusé signé du web ; web→Android reçu et déchiffré ; accusé Android vérifié par le web (`verified:true`) ; message saisi hors connexion renvoyé à la reconnexion puis « Délivré » |
| **Interopérabilité via le tunnel public** | même test, `MESHORA_INTEROP_RELAY=wss://….trycloudflare.com` | 1/1 : OkHttp en **TLS/WSS** à travers Cloudflare, échange et accusés dans les deux sens |
| Compilation | `assembleDebug assembleRelease bundleRelease` | OK ; `targetSdkVersion 36` ; APK de débogage 17,6 Mo ; AAB **non signé** 11,2 Mo (aucune clé valable disponible : c'est voulu) |
| Absence de WebView | `aapt2 dump badging`, sources | aucune activité ou dépendance WebView |

Limite : ces essais tournent sur JVM (le code Kotlin de l'application, sans l'interface ni le système Android). **Aucun essai sur téléphone Android n'a été fait.** Aucun émulateur n'est configuré sur le Mac.

## 3. Google Play — ce qui manque avant la bêta fermée (à valider)

1. **Nouvelle clé d'importation**, générée hors dépôt (`keytool -genkeypair -alias meshora-upload -keyalg RSA -keysize 4096 -validity 10000 -keystore ~/.meshora/meshora-upload.jks`), mot de passe dans un gestionnaire, puis `~/.meshora/signing.properties`. Play App Signing conserve la clé de signature finale.
2. Compte développeur : si compte **personnel** créé après le 13/11/2023, test fermé avec **au moins 12 testeurs inscrits 14 jours consécutifs** avant l'accès production.
3. Cible API 36 (fait), mise à jour d'AGP recommandée.
4. Retirer les permissions BLE / service de premier plan tant que le BLE n'existe pas (A-P1-8), ou remplir les déclarations Play correspondantes.
5. Corriger les textes de la fiche (A-P1-6, A-P1-7, A-P2-1) et le guide (A-P2-2).
6. Politique de confidentialité à une adresse publique contrôlée (par exemple la page `/fr/confidentialite/` du site, une fois publiée).

## 4. Essai Mac ↔ Android (prêt, à faire sur appareil)

APK de débogage construit à `68e7822` : `~/meshora-test-relay/MESHORA-android-debug-68e7822.apk` sur le Mac (non publié).

1. Installer : `adb install -r ~/meshora-test-relay/MESHORA-android-debug-68e7822.apk` (téléphone en mode développeur, câble USB) ou copie du fichier puis installation manuelle (sources inconnues).
2. Onglet **Réseau** : relais `wss://<tunnel>.trycloudflare.com`, salon `essai1` → « Connecter au relais » → attendu « CONNECTÉ (identité prouvée) ».
3. Sur le Mac : ouvrir le lien de prévisualisation du même salon (voir `docs/tests/ESSAI-MAC-TELEPHONE-V0.2.md`).
4. Onglet **Messages** du téléphone : le pair web apparaît ; envoyer ; attendu « Délivré » côté Android et réception côté Mac. Envoyer depuis le Mac : attendu réception sur Android.
5. Répéter en 4G/5G, puis téléphone hors ligne → envoi Mac → retour en ligne.

Note : l'application web envoie au **salon** (une enveloppe par pair), l'application Android à **un destinataire** (premier pair listé ou clé saisie).

## 5. Revue indépendante de la PR #8 et suites (26 octobre 2026)

Une revue en lecture seule par un agent distinct (n'ayant pas écrit le code) a conclu « corrections acceptables, aucun P0 » et relevé des P1/P2. Traitement (commit `3b4dca0`) :

| Constat | Gravité | Traitement |
|---|---|---|
| Renvois sans fin toutes les 15 s, boîte aux lettres du relais saturable, rafales d'accusés, coupure 1008 | P1 | Attente progressive 15 s → 10 min, 20 messages par passe, renvoi forcé seulement vers un destinataire présent ; accusé réémis au plus toutes les 30 s ; le relais remplace un renvoi (même expéditeur, même id) au lieu de l'empiler. Même logique côté web |
| Événements d'une connexion remplacée qui écrasent l'état | P1 | Numéro de génération par connexion |
| Pas de reconnexion automatique | P1 | Reconnexion 2 s → 60 s sauf déconnexion volontaire |
| Accusé ne liant ni l'expéditeur ni le contenu ; déduplication sur l'id seul ; accusés diffusés à tout le salon | P1 (protocole) | **Accusé v2** (`ACK2|id|expéditeur|destinataire|SHA-256(enveloppe)|ts`), messages reçus indexés par (expéditeur, id), relais : accusé remis à l'expéditeur seul. Web, Android et relais alignés ; banc T11 ajouté |
| API 36 avec AGP 8.7.3 | P1 | AGP 8.9.3, compilation et tests verts |
| Trames traitées dans le désordre ; `PEERS` malformé ; champs partagés sans `@Volatile` | P2 | Traitement sur le fil de lecture OkHttp, analyse élément par élément, `@Volatile` |
| Clé destinataire saisie sans validation (plantage possible) | P2 | Normalisation et validation ; message d'erreur dans l'interface |
| Test d'identifiant tautologique ; affirmations non testées | P2 | Vecteur indépendant calculé avec Node ; tests réécrits (accusé de tiers, enveloppe jamais émise, préemption d'id, clé invalide, attente progressive) |
| Script d'interopérabilité qui ne détecte pas un essai ignoré | P2 | Échec si robot non prêt ou essai ignoré ; attente de `/health` |
| `storeFile` relatif ; `*.p12/*.pfx/*.pem` non ignorés ; historique dans les sauvegardes ; clavier sur la saisie | P2 | Chemin absolu exigé ; motifs ajoutés ; `meshora_messages.xml` exclu ; `imePadding()` |
| Service de premier plan sans contrôle de permission ; trafic en clair limité à quelques IP | P2 | Non traités (service non utilisé ; `wss://` documenté) |

## 6. Nouvelle clé d'importation (26 octobre 2026)

| | |
|---|---|
| Emplacement | `~/.meshora/meshora-upload-2026-10.jks` sur le Mac (dossier `700`, fichier `600`), **hors dépôt** |
| Type | PKCS12, RSA 4096, alias `meshora-upload`, valable jusqu'en 2054, `CN=MESHORA Upload, O=MESHORA, C=FR` |
| Mot de passe | Généré aléatoirement (40 caractères), stocké **uniquement** dans le trousseau macOS (service `org.meshora.android.upload`) ; jamais écrit sur disque ni affiché |
| Empreinte SHA-256 | `5F:18:1E:DB:A7:93:98:21:EF:69:01:57:5B:51:BF:3A:87:23:7E:A0:13:6A:E8:96:70:26:7A:92:3C:2D:F2:F2` |
| Ancienne clé (compromise) | `07:6D:EA:03:29:2A:0C:21:…:CE:EB:C1:BA` — différente ; jamais utilisée |
| Construction | `bash tools/android/build-signed.sh` → APK signé (schéma v2 vérifié par `apksigner`), AAB signé (`jar verified`), version `0.2.1-beta` (3), `targetSdk 36` |
| Contrôles | Aucun `.jks`, `.keystore`, `.p12`, fichier de signature ni mot de passe suivi par Git sur la branche ; l'ancien fichier subsiste seulement dans `android/native-beta` et dans le dossier local d'Antigravity |

**Sauvegarde à faire par le directeur artistique** : copier `~/.meshora/meshora-upload-2026-10.jks` et le mot de passe (trousseau → « MESHORA Android upload key ») dans un coffre (gestionnaire de mots de passe). Avec Play App Signing, une clé d'importation perdue se réinitialise, mais cela prend du temps.
