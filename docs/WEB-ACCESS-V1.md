# MESHORA V1 — accès Web et connexion rapide

> Statut : 📐 architecture proposée le 27 octobre 2026. Ce document ne rend ni un VPN ni un accès à un service externe disponibles.

## But utilisateur

Depuis un écran unique, comprendre immédiatement lequel de ces états est vrai :

| État affiché | Condition minimale vérifiable | Ce que cela ne veut pas dire |
|---|---|---|
| Internet disponible | Une requête vers le relais configuré aboutit et son identité est vérifiée. | Tous les sites sont accessibles. |
| Connexion protégée | Le canal MESHORA a établi son authentification et son chiffrement. | Que le trafic des autres applications passe dans un VPN. |
| Mesh local seulement | Un transport de proximité a été réellement détecté puis testé pour la session. | Que le relais Bluetooth en arrière-plan fonctionne sur tous les téléphones. |
| Hors ligne | Aucun de ces chemins ne répond. Les brouillons restent locaux. | Qu'un message est parti ou sera forcément livré. |

L'écran principal doit proposer « Se connecter », afficher la cause d'un échec et offrir « Réessayer ». Une reconnexion ne reprend que les choix déjà consentis par la personne.

## Accès Web et services sociaux

La première version n'est pas un navigateur parallèle et ne stocke aucun mot de passe de réseau social. Elle pourra proposer des raccourcis locaux vers les services choisis par la personne, ouverts par le navigateur ou l'application officielle disponible. Chaque raccourci montre seulement un état observé : accessible, indisponible ou inconnu. Une réponse HTTP, DNS ou de portail captif ne vaut jamais une promesse d'accès durable.

MESHORA ne contourne ni l'authentification d'une plateforme ni les règles applicables dans le pays de l'utilisateur. Une passerelle volontaire est désactivée par défaut, visible dans l'interface et activée seulement après consentement explicite de son propriétaire.

## VPN : prérequis avant code de production

Il n'existe pas encore de `VpnService` MESHORA ni de passerelle VPN financée. Aucune formule « gratuite et illimitée » n'est annoncée. Avant toute implémentation, il faut une passerelle identifiée, sa capacité, son coût, sa politique de journaux, son protocole maintenu et l'accord de son exploitant.

Sur Android, le démarrage doit d'abord passer par le consentement système `VpnService.prepare()`. Le service doit déclarer `BIND_VPN_SERVICE`, fermer proprement le tunnel lors de `onRevoke()` et empêcher une boucle du tunnel en protégeant son propre socket. L'option « toujours actif » reste désactivée tant qu'elle n'a pas été testée : Android peut la maintenir après redémarrage et mise à jour, et le mode blocage coupe le trafic hors VPN.

Google Play impose que l'usage de `VpnService` corresponde à sa fonction principale ou à une exception admise, que le tunnel vers son point de terminaison soit chiffré, et que toute collecte éventuelle fasse l'objet d'une information visible dans l'application et d'un consentement explicite. Il faudra la déclaration Play et la vidéo de démonstration avant toute soumission.

Sources officielles :

- [Android VpnService](https://developer.android.com/develop/connectivity/vpn)
- [Référence Android VpnService](https://developer.android.com/reference/android/net/VpnService)
- [Règles Google Play pour VpnService](https://support.google.com/googleplay/android-developer/answer/12564964)

## Ordre de livraison

1. Écran Connexion rapide : diagnostic réel, réessai et états ci-dessus ; aucun état déduit uniquement de `navigator.onLine`.
2. Raccourcis Web locaux, sans identifiants ni contournement d'authentification.
3. Prototype VPN seulement avec une passerelle de test identifiée et consentement système ; arrêt toujours accessible.
4. Mesures Pixel : coupure du tunnel, DNS, IPv4, IPv6, changement Wi-Fi/4G-5G, batterie, redémarrage et refus de consentement.
5. Revue de coût, politique Play et confidentialité avant Play ou production.

## Décision à prendre plus tard

Choisir une passerelle de test réellement disponible et son budget. Sans cette décision, l'application peut montrer honnêtement « VPN non configuré », mais ne doit pas ajouter de faux bouton de connexion protégée.
