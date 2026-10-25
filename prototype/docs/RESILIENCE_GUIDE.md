# Guide de la Continuité Intelligente & Résilience

Le module **MESHORA Resilience** garantit la disponibilité des communications vitales lors de coupures ou d'altérations réseau, en évitant toute dramatisation anxiogène.

---

## 1. Principes Directeurs

- **Continuité fluide et transparente** : Lorsque la connexion Internet principale est coupée, l'application bascule automatiquement et silencieusement sur le réseau local pour maintenir la communication avec les personnes et appareils proches.
- **Protection du consentement utilisateur** : MESHORA ne réacheminera jamais votre trafic vers une passerelle Internet inconnue, non vérifiée ou tierce sans vous avoir présenté un panneau d'autorisation explicite indiquant l'identifiant et les caractéristiques du relais.
- **Zéro message perdu** : Les messages rédigés en zone blanche sont horodatés et stockés dans la file d'attente d'envoi locale (`OutboxQueue`). Dès qu'un transport compatible redevient disponible (reconnexion Wi-Fi, passage près d'un nœud mesh relais, retour 4G/5G), la synchronisation s'exécute automatiquement.
- **Ressources d'urgence locales en cache** : Fiches pratiques de secours (premiers secours, gestes d'urgence, protocoles de contact radio) et carte vectorielle de secteur toujours consultables hors ligne.
- **Économie d'énergie intégrée** : En réduisant la fréquence des requêtes de détection en arrière-plan et les animations superflues, le profil économie de batterie prolonge l'autonomie de votre appareil.
- **Alertes communautaires signées** : Possibilité d'émettre ou de recevoir des avis d'urgence vérifiables localement grâce à une empreinte cryptographique d'authentification.
