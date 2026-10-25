# Guide de Déploiement — Bêta Fermée Google Play (MESHORA)

Ce guide décrit la procédure de mise en ligne sur la Google Play Console pour le test fermé (Closed Testing track).

---

## 1. Prérequis & Fichiers Produits

1. **Package ID :** `org.meshora.app`
2. **Version :** `0.2.0-beta` / `versionCode 2`
3. **Android App Bundle (AAB) :** `android/app/build/outputs/bundle/release/app-release.aab`
4. **APK de test direct :** `android/app/build/outputs/apk/release/app-release.apk`
5. **Clé de signature Upload :** `android/meshora-upload.jks`
   - Alias : `meshora-upload`
   - Algorithme : RSA 4096 bits
   - Empreinte SHA-256 : vérifiable via `keytool -list -v -keystore android/meshora-upload.jks`

---

## 2. Configuration dans Google Play Console

### Étape 1 : Créer l'application
1. Se connecter à [Google Play Console](https://play.google.com/console).
2. Cliquer sur **Créer une application**.
3. Nom : `MESHORA`.
4. Langue par défaut : `Français (France)`.
5. Type : `Application` / Gratuit.
6. Valider les déclarations de conformité.

### Étape 2 : Fiche de l'application (Store Listing)
- Copier les textes depuis `docs/play-store/FICHE_GOOGLE_PLAY.md`.
- Téléverser l'icône haute résolution (512x512 PNG, `site/assets/icons/icon-512.png`).
- Téléverser l'image de bannière (1024x500 PNG).
- Renseigner l'URL de politique de confidentialité : `docs/play-store/PRIVACY.md` hébergée sur le site public.

### Étape 3 : Déclarations de contenu obligatoires
1. **Accès aux fonctionnalités :** Toutes les fonctionnalités sont disponibles sans restriction ni identifiants.
2. **Publicités :** Déclarer « Non, mon application ne contient aucune publicité ».
3. **Public cible :** Sélectionner 18 ans et plus (ou Tout public selon la politique choisie).
4. **Sécurité des données (Data Safety) :**
   - Aucune donnée collectée à des fins commerciales ou publicitaires.
   - Les messages sont chiffrés de bout en bout (E2EE en transit) et stockés localement sur l'appareil.
   - Aucune donnée n'est transmise à des tiers.

### Étape 4 : Piste de test fermé (Closed Testing Track)
1. Aller dans **Tester** > **Test fermé**.
2. Créer une nouvelle piste (ex: `Beta Pionniers MESHORA`).
3. Créer une liste d'utilisateurs testeurs (adresses e-mail des participants).
4. Créer une nouvelle version et téléverser le fichier `app-release.aab`.
5. Renseigner les notes de version :
   ```
   MESHORA V0.2.0-beta :
   - Cœur cryptographique souverain ECDSA P-256 / AES-256-GCM
   - Accusés de réception signés (SignedAck) et Outbox résiliente
   - Relais WebSocket aveugle et architecture native Bluetooth LE (0xFE60)
   ```
6. Enregistrer et soumettre pour examen Google Play.
