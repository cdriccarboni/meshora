# Architecture Technique de MESHORA

Ce document décrit les principes fondamentaux, les frontières de couches et le découplage modulaire du prototype MESHORA v0.1.

---

## 1. Principes de Conception

1. **Fonctionner avec l'existant plutôt que remplacer** : MESHORA ne crée pas un protocole propriétaire isolé, mais unifie les liaisons de communication existantes (réseau local IP, WebSockets, Bluetooth LE, protocoles LoRa Meshtastic, Reticulum, passerelles Internet).
2. **Découplage strict des responsabilités** :
   - `UI (Présentation)` : Composants React 19 hautement accessibles, réactifs et sans état métier bloquant.
   - `Messaging & Outbox` : Routage des messages, gestion des canaux et file d'attente hors ligne persistante.
   - `Identity` : Paires de clés cryptographiques locales, empreinte d'authentification et pseudonyme d'appareil.
   - `Storage` : Abstraction de persistance multi-niveaux (IndexedDB prioritaire, repli localStorage).
   - `Transports` : Couche d'adaptation polymorphe avec détection dynamique de disponibilité (`BroadcastChannel`, `WebSocket`, `Bluetooth`, `LoRa`, `Reticulum`).
   - `Shield & Security` : Contrôleur d'intégrité VPN, protection contre les fuites DNS et détection de ponts non autorisés.
   - `Resilience Engine` : Basculement sécurisé consenti, mode économie d'énergie, cartes/documents d'urgence et alertes vérifiables.

---

## 2. Diagramme de Flux de Données

```
[ Événement Utilisateur / Envoi Message ]
                  │
                  ▼
         [ MessageStore / Outbox ] ──(Écriture locale persistante)──> [ IndexedDB ]
                  │
                  ▼
         [ NetworkSentinel ] ──(Vérification d'état réseau)
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
[ En Ligne / Local ]     [ Hors Ligne ]
       │                     │
       ▼                     ▼
[ TransportManager ]     [ Maintien en file Outbox ]
       │
  (Sélection adaptateur autorisé)
       │
 ┌─────┼─────────────────────┬──────────────────┐
 ▼     ▼                     ▼                  ▼
[LAN] [BroadcastChannel] [Bluetooth LE*] [Meshtastic/LoRa*]
```

---

## 3. Vérité de Sécurité & Non-Tromperie

MESHORA impose une règle inviolable : **ne jamais masquer l'état réel du réseau ou de la sécurité sous une fausse promesse cosmétique**.
- Si une connexion VPN WireGuard est sollicitée mais qu'aucun démon natif n'est connecté, l'interface affiche explicitement `Nécessite un module natif` et `Protection inactive`.
- Les communications locales sont étiquetées avec leur transport exact (`LAN Direct`, `BroadcastChannel`, `Relais`).
- Les simulations topologiques portent la mention explicite `Simulation topologique`.
