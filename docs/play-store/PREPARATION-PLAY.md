# Google Play — préparation (26 octobre 2026)

> Document de préparation. **Rien n'est publié.** Chaque envoi sur la Play Console se fait par le directeur artistique, sur son compte.
> Complète les documents d'Antigravity (`FICHE_GOOGLE_PLAY.md`, `PRIVACY.md`, `CLOSED_BETA_GUIDE.md`) sans les remplacer ; les corrections nécessaires y sont listées au §5.

## 1. Ce qui est prêt

| Élément | État |
|---|---|
| AAB signé avec la **nouvelle** clé d'importation | ✅ `bash tools/android/build-signed.sh` → `android/app/build/outputs/bundle/release/app-release.aab` (0.2.1-beta code 3, ou 0.3.0-alpha-ble1 code 4) |
| Cible API 36 (exigence Play depuis le 31/08/2026) | ✅ |
| Icône 512 × 512 | ✅ `site/assets/icons/icon-512.png` |
| Politique de confidentialité à une adresse publique | ✅ possible dès maintenant : `https://github.com/cdriccarboni/meshora/blob/<branche fusionnée>/docs/play-store/PRIVACY.md` (dépôt public), après corrections du §5 ; plus tard la page `/fr/confidentialite/` du site en production |
| Essai réel | ✅ Internet : Pixel 9 ↔ Mac (Wi-Fi, 5G, différé). ⬜ Bluetooth : à essayer |

## 2. Ordre conseillé

1. **Test interne** (Play Console → Tester → Test interne) : jusqu'à 100 testeurs par adresse e-mail. Il n'y a pas d'examen long, et cela permet aux amis d'installer **depuis le Play Store**. AAB conseillé : 0.2.1-beta (testé), puis 0.3.0 une fois le Bluetooth essayé.
2. **Test fermé** : obligatoire avant la production pour un compte **personnel** créé après le 13/11/2023, avec au moins **12 testeurs inscrits 14 jours consécutifs**. Un compte d'organisation n'y est pas soumis.
3. **Production** : seulement après le test fermé et votre accord.

## 3. Formulaire « Sécurité des données » (proposition, à valider)

Règle Google : les données **chiffrées de bout en bout** (illisibles par tout intermédiaire, développeur compris) ne sont pas à déclarer comme « collectées ».

| Donnée | Envoyée hors de l'appareil ? | Proposition |
|---|---|---|
| Contenu des messages | Oui, chiffré de bout en bout ; illisible par le relais | **Non collecté** (exemption de chiffrement de bout en bout) |
| Clé publique, pseudonyme, salon | Oui, au relais de test (et aux appareils proches en Bluetooth) | **Collecté : identifiants utilisateur (pseudonymes)**. Usage : fonctionnement de l'application. Non partagé. Le relais les garde en mémoire, et jusqu'à 24 h pour le courrier en attente |
| Adresse IP | Vue par le relais (et par Cloudflare via le tunnel) | À mentionner dans la politique de confidentialité |
| Localisation, contacts, publicité, analyse | Non | Non collectées. `BLUETOOTH_SCAN` porte le drapeau `neverForLocation` |
| Chiffrement en transit | Oui (`wss://`, chiffrement de bout en bout) | « Les données sont chiffrées en transit » : oui |
| Suppression des données | Désinstallation ou effacement local ; le relais n'a pas de stockage durable | À décrire |

## 4. Autres déclarations de la Play Console

| Rubrique | Proposition |
|---|---|
| Accès à l'application | Aucune connexion requise |
| Publicités | Aucune |
| Classification du contenu | Application de communication ; les utilisateurs peuvent échanger entre eux |
| Public cible | Adultes (18+) recommandé pour la bêta |
| Permissions sensibles | **Retirer avant l'envoi** `FOREGROUND_SERVICE_CONNECTED_DEVICE` et le service inutilisé ; sinon Google exige une déclaration avec vidéo. `POST_NOTIFICATIONS` inutile tant qu'il n'y a pas de notifications |
| Contenu généré par les utilisateurs | Messagerie privée chiffrée : vérifier les exigences de la politique « Contenu généré par les utilisateurs » (signalement, blocage) **avant la production** |
| Coordonnées | Adresse e-mail de contact **réelle** et contrôlée. `support@meshora.org` n'est pas à vous tant que le domaine n'est pas enregistré |
| Visuels | Bannière 1024 × 500 à créer ; au moins 2 captures d'écran du Pixel (Messages, Réseau) |

## 5. Corrections à apporter aux documents existants (Antigravity)

- `FICHE_GOOGLE_PLAY.md` :
  - retirer « Service standardisé 0xFE60 » ;
  - retirer « Données chiffrées stockées » : l'historique est stocké en clair sur l'appareil, exclu des sauvegardes ;
  - retirer « réseau maillé civil résilient » tant que le Bluetooth n'est pas démontré ;
  - remplacer les adresses `meshora.org`.
- `PRIVACY.md` :
  - mentionner l'adresse IP vue par le relais et par Cloudflare ;
  - mentionner la boîte aux lettres de 24 h ;
  - mentionner l'identifiant Bluetooth visible à proximité ;
  - retirer « chiffrés localement ».
- `CLOSED_BETA_GUIDE.md` :
  - retirer toute mention de `android/meshora-upload.jks` (clé compromise) ;
  - ajouter le test interne et la règle « 12 testeurs × 14 jours ».

## 6. Ce que seul le directeur artistique peut faire

1. Compte Play Console (frais d'inscription uniques), vérification d'identité, type de compte (personnel ou organisation).
2. Créer l'application `org.meshora.app` et activer Play App Signing ; enregistrer la clé d'importation d'empreinte `5F:18:1E:DB:…:2D:F2:F2`.
3. Inviter les testeurs (adresses e-mail Google des amis).
4. Envoyer l'AAB et valider chaque mise en ligne.
