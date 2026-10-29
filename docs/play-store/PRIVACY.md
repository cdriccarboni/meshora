# Politique de Confidentialité — Application MESHORA (Android)

**Dernière mise à jour : 25 octobre 2026**
**URL Publique recommandée :** `https://meshora.org/privacy` ou `https://meshora.pages.dev/fr/confidentialite/`

La présente politique de confidentialité décrit le traitement minimal et strictement local des données effectué par l'application native Android **MESHORA** (`org.meshora.app`), développée dans un objectif de souveraineté numérique et de résilience civile.

---

## 1. Données Personnelles et Identité

- **Aucune création de compte :** MESHORA n'exige aucun numéro de téléphone, aucune adresse e-mail, aucun nom civil ni aucun identifiant publicitaire.
- **Identité cryptographique locale :** L'application génère une paire de clés asymétriques ECDSA P-256 stockée de manière sécurisée dans l'espace de stockage privé de votre appareil. Cette clé privée ne quitte jamais votre téléphone.
- **Empreinte publique :** Seule votre clé publique hexadécimale et son empreinte hachée (SHA-256) sont partagées avec les pairs avec lesquels vous communiquez pour permettre le chiffrement et la vérification des signatures.

---

## 2. Contenu des Messages et Chiffrement de Bout en Bout (E2EE)

- Tous les messages rédigés sont chiffrés localement sur votre téléphone avant transmission en utilisant le standard AES-256-GCM combiné à un échange de clés éphémère ECDH.
- Les relais de transit (WebSocket ou nœuds intermédiaires) ne traitent que des enveloppes chiffrées indéchiffrables. Ils n'ont jamais accès au contenu des conversations ni aux clés privées.
- Les messages et les accusés de réception sont conservés exclusivement sur votre appareil et peuvent être supprimés à tout moment.

---

## 3. Autorisations Android Demandées et Justification Technique

Conformément aux exigences de Google Play, chaque permission demandée répond à une stricte nécessité fonctionnelle :

1. **`BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT` :**
   - *Finalité :* Permettre la découverte directe et l'échange de trames chiffrées entre appareils à proximité sans passer par Internet via le profil standardisé MESHORA (GATT Service `0xFE60`).
   - *Drapeau `neverForLocation` :* MESHORA n'utilise pas le Bluetooth pour déterminer ou déduire votre position géographique physique.
2. **`INTERNET` & `ACCESS_NETWORK_STATE` :**
   - *Finalité :* Permettre la connexion aux relais WebSocket configurés par l'utilisateur pour acheminer les enveloppes chiffrées lorsque les terminaux ne sont pas à portée radio directe.
3. **`FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_CONNECTED_DEVICE` :**
   - *Finalité :* Maintenir l'écoute des messages entrants et la transmission des accusés de réception lorsque l'écran est éteint ou l'application en arrière-plan.
4. **`POST_NOTIFICATIONS` :**
   - *Finalité :* Afficher l'indicateur permanent de service réseau actif et avertir l'utilisateur de l'arrivée d'un message urgent.

---

## 4. Partage avec des Tiers et Régies Publicitaires

- **Zéro pistage (Tracker-Free) :** MESHORA n'intègre aucun SDK d'analyse (pas de Google Analytics, pas de Firebase Analytics, pas de Mixpanel).
- **Zéro publicité :** Aucun réseau publicitaire, aucun identifiant publicitaire Android (AD_ID) n'est collecté.
- **Aucune monétisation de données :** Aucune donnée n'est vendue, cédée ou transmise à des tiers ou courtiers de données.

---

## 5. Contact du Délégué à la Protection des Données

Pour toute question relative à cette politique de confidentialité ou aux vérifications de conformité Google Play :
- E-mail : `confidentialite@meshora.org`
- Code source et spécifications : `https://github.com/cdriccarboni/meshora`
