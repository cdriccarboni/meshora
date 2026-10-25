# MESHORA Resilience — Module 4

> Version 0.1 — 25 octobre 2026. S'appuie sur `ARCHITECTURE.md` (cœur, transports), `SECURITY.md` et `SHIELD-SECURITY-AUDIT.md` (VPN, passerelles).
> Convention de preuve : **[S]** sourcé · **[C]** connaissance du domaine · **[T]** à trancher par test sur appareil physique.

## 0. Les quatre modules MESHORA

| Module | Rôle | Document |
|---|---|---|
| 1. **Core** | Identité, enveloppe chiffrée, stockage-relais, transports | ARCHITECTURE, SECURITY |
| 2. **Bridges** | Meshtastic, MeshCore, Reticulum, Nostr, Mastodon, Bluesky | ARCHITECTURE §5–6 |
| 3. **Shield** | VPN WireGuard personnel, DNS chiffré, Tor optionnel | SHIELD-SECURITY-AUDIT |
| 4. **Resilience** | Continuité de communication quand les réseaux se dégradent | ce document |

Resilience **n'ajoute pas de nouveau protocole**. C'est la couche de décision et d'affichage au-dessus du Core et de Shield : elle détecte, choisit, prévient, et ne ment jamais sur l'état réel.

## 1. Règles impératives → règles d'implémentation

| Règle | Traduction technique vérifiable |
|---|---|
| Aucun basculement vers une passerelle inconnue sans consentement | Le gestionnaire de transports ne peut sélectionner une passerelle que si son niveau de confiance ≥ celui autorisé par l'utilisateur. Le niveau « inconnue » exige une confirmation par action explicite, à chaque fois (pas de « toujours » par défaut). Test R3. |
| Aucun message perdu silencieusement | Chaque message sortant a un état persistant (§3). Toute fin non livrée (expiration, stockage plein, refus, suppression par quota) produit une notification visible à l'émetteur. Test R4. |
| Aucun affichage trompeur | Chaque indicateur est calculé à partir d'une preuve (§4), jamais d'une intention. En l'absence de preuve, l'état affiché est « inconnu », pas « connecté ». Test R9. |
| Respect des restrictions iOS et Android | Aucune technique de maintien en vie détournée (localisation, VoIP, audio silencieux). Les limites sont affichées dans l'app. Revue avant soumission. |
| Tests sur appareils physiques | Une fonction n'apparaît comme « disponible » dans `STATUS.md` qu'avec un rapport de test archivé dans `docs/tests/`. |

## 2. Fonctions : faisabilité et conception

| Fonction | Conception | iOS | Android | Niveau |
|---|---|---|---|---|
| **Détection des pertes de connexion** | Signal système (`NWPathMonitor` sur Apple, `ConnectivityManager` sur Android) **+ preuve active** : réponse d'un relais Nostr ou de sa passerelle. Détection des portails captifs (« Wi-Fi connecté mais pas d'Internet »). | ✅ au premier plan ; en arrière-plan, pas de sonde périodique garantie | ✅ | [C], seuils [T] |
| **Basculement des transports** | Gestionnaire de transports (SHIELD §3.4) : envoi parallèle par tous les chemins **autorisés**, déduplication par identifiant. Jamais de repli silencieux vers moins protecteur. | ✅ | ✅ | [C] |
| **Communication locale sans Internet** | BLE GATT + LAN (mDNS/TCP). | ✅ premier plan ; 🟡 arrière-plan | ✅ | [S] interop BLE premier plan (Bitchat) ; arrière-plan [T] |
| **Messages hors ligne, synchro différée** | Stockage-relais du Core + Nostr à la reconnexion. | ✅ | ✅ | [C], E9 |
| **Recherche de relais mesh compatibles** | Scan BLE sur l'UUID de service MESHORA ; mDNS sur LAN ; radios compagnon LoRa appairées. Les relais annoncent version et capacités. | 🟡 scan arrière-plan bridé | ✅ | [T] E2, E4 |
| **Recherche de passerelles fiables** | Les passerelles diffusent sur le mesh une **annonce signée** (identité, capacités : Nostr, VPN, LoRa ; âge de la dernière preuve Internet). Fiabilité = niveau de confiance (§2.1), pas popularité. | ✅ | ✅ | [C] |
| **Cartes hors ligne** | MapLibre (BSD) + fichiers PMTiles vectoriels d'une zone, préparés par la passerelle ou téléchargés à l'avance. Données OpenStreetMap (ODbL, attribution obligatoire). **Interdit** : télécharger en masse depuis les serveurs de tuiles d'OpenStreetMap (politique d'usage). | ✅ | ✅ | [C] tailles par zone [T] |
| **Documents hors ligne** | Paquets signés (PDF, fiches pratiques) adressés par empreinte, mis en cache, partageables pair à pair, avec vérification de signature de l'éditeur. | ✅ | ✅ | [C] |
| **Échanges de fichiers** | Découpage en blocs avec empreintes, reprise après coupure. Transports : LAN (rapide), Multipeer (Apple ↔ Apple), BLE (lent : réservé aux petits fichiers), Wi-Fi Aware plus tard. **Jamais par LoRa.** | ✅ | ✅ | débits [T] |
| **Mode économie de batterie** | Profils : *Normal*, *Économie* (scans espacés, pas de relais de fichiers, synchro groupée), *Veille relais* (Android et relais fixes uniquement). Consommation mesurée et affichée par profil. | 🟡 marge de manœuvre faible (le système décide déjà) | ✅ | [T] T5 |
| **Alertes communautaires vérifiables** | Voir §2.2. | ✅ | ✅ | [C] |
| **Indicateur VPN et chiffrement** | Voir §4. | ✅ | ✅ | [C] |

### 2.1 Niveaux de confiance des passerelles et relais
| Niveau | Définition | Utilisation automatique |
|---|---|---|
| **Moi** | Passerelle signée par ma propre identité | Oui |
| **Groupe** | Signée par un membre d'un groupe que j'ai rejoint et marqué « faire confiance aux passerelles du groupe » | Oui, si activé |
| **Contact vérifié** | Signée par un contact vérifié par QR | Sur réglage explicite |
| **Inconnue** | Toute autre | **Jamais sans confirmation à chaque fois** |

Pour le **relais de messages** (chiffrés de bout en bout), tout voisin peut servir : il ne lit rien. La confiance ne conditionne que les **passerelles** (Internet, VPN, publication), qui voient des métadonnées ou du trafic.

### 2.2 Alertes communautaires vérifiables
- Une alerte est un message public **signé** par son émetteur, avec zone, durée de validité et catégorie.
- **« Vérifiable » ne veut pas dire « vrai »** : l'app affiche *qui* a signé et *si* on connaît cette clé, jamais un label « alerte officielle » qu'elle ne peut pas prouver.
- Émetteurs reconnus : listes de clés que l'utilisateur choisit de suivre (son collectif, sa compagnie, une association locale). Aucune liste imposée à distance.
- Alertes non signées par un émetteur suivi : affichées comme « message public non vérifié », sans son ni notification prioritaire, avec quota de relais réduit (anti-panique, anti-spam).
- MESHORA **ne remplace pas** les systèmes officiels d'alerte des populations (en France, FR-Alert par diffusion cellulaire [C]). Le dire dans l'app.

## 3. États d'un message (règle « aucune perte silencieuse »)

```
brouillon → en file → remis à N voisin(s) / publié sur Nostr → livré (accusé du destinataire) → lu (optionnel)
                    ↘ expiré sans accusé  → NOTIFICATION à l'émetteur + proposer de renvoyer
                    ↘ refusé (taille, quota, transport interdit) → NOTIFICATION immédiate
                    ↘ stockage local plein → NOTIFICATION, aucun effacement automatique de messages non livrés
```
- « Remis à un voisin » ≠ « livré ». L'interface affiche les deux distinctement.
- Les messages relayés pour d'autres peuvent être évincés (quotas) ; les messages **de l'utilisateur** jamais sans notification.

## 4. Indicateur d'état : sources de vérité

> Les libellés ci-dessous décrivent la **logique**. Le texte et les couleurs réellement affichés sont ceux de `DESIGN.md` §8 (nom affiché du module : « Continuité », sans vocabulaire anxiogène ; ambre doux au lieu d'orange).

| Élément affiché | Affiché seulement si… | Sinon |
|---|---|---|
| « Internet » | Réponse d'un relais ou de la passerelle depuis < 60 s | « Internet : non vérifié » |
| « Protégé par ta passerelle » | Tunnel WireGuard actif **et** poignée de main récente (< 3 min) | « Connexion directe » en orange |
| « Tor » | Circuit établi et testé | « Tor : en cours » / « échec » |
| « Chiffré de bout en bout, contact vérifié » | Clé du contact vérifiée par QR | « Chiffré, contact non vérifié » |
| « N relais à proximité » | Voisins vus dans les 2 dernières minutes | Compteur à 0, jamais une estimation |
| « Relais en arrière-plan » (iOS) | Jamais affiché comme garanti | « Le relais peut s'interrompre quand l'app est fermée » |

## 5. Contrat d'interface pour le prototype Google AI Studio

Les adaptateurs du prototype doivent respecter ces types (miroir des traits Rust du Core) afin que l'interface se branche plus tard sur les vrais transports sans réécriture. Le prototype ne fournit que des implémentations **simulées**, clairement nommées `Sim*`.

```ts
// Types partagés — v0, susceptibles d'évoluer via PR sur docs/
type TransportKind = "ble" | "lan" | "lora_companion" | "nostr" | "wifi_aware" | "multipeer" | "sim";
type Trust = "self" | "group" | "verified_contact" | "unknown";
type Evidence = { observedAt: number; source: string };   // toute affirmation d'état porte sa preuve

interface TransportStatus {
  kind: TransportKind;
  available: boolean;
  evidence?: Evidence;          // absent => l'UI affiche « inconnu »
  peers: number;                // voisins réellement vus
  mtuBytes: number;
  allowedByUser: boolean;
  platformLimit?: string;       // ex. « arrière-plan limité sur iOS »
}

interface GatewayAnnouncement {
  id: string;                   // empreinte de clé
  trust: Trust;
  capabilities: Array<"internet" | "nostr" | "vpn" | "lora" | "social_publish">;
  lastInternetProof?: Evidence;
  signatureValid: boolean;
}

type MessageState =
  | "draft" | "queued" | "handed_to_peer" | "published_nostr"
  | "delivered" | "read" | "expired" | "rejected" | "storage_full";

interface ProtectionStatus {
  e2e: "verified" | "unverified" | "public";
  vpn: "off" | "on_verified" | "on_unverified" | "error";
  tor: "off" | "connecting" | "on" | "error";
  internet: "verified" | "unverified" | "offline";
}

interface ResilienceAdapter {
  transports(): TransportStatus[];
  gateways(): GatewayAnnouncement[];
  requestGatewayConsent(g: GatewayAnnouncement): Promise<"accept_once" | "refuse">;
  send(to: string, body: Uint8Array): Promise<string>;      // renvoie un id de message
  onMessageState(cb: (id: string, s: MessageState) => void): void;
  protection(): ProtectionStatus;
  setBatteryProfile(p: "normal" | "eco" | "relay_standby"): void;
}
```

Consignes :
1. Implémenter `SimResilienceAdapter` avec pannes, latences et partitions réglables, pour démontrer chaque état (dont `expired`, `storage_full`).
2. Un écran « Diagnostic » listant les transports, leurs preuves et leurs limites de plateforme.
3. Le consentement passerelle inconnue : écran bloquant, sans case « toujours » cochée par défaut.
4. Bannière permanente « Prototype — réseau simulé » tant que l'adaptateur est un `Sim*`.

## 6. Tests spécifiques Resilience (complètent ROADMAP §3 et SHIELD §9)

| Id | Test | Critère |
|---|---|---|
| R1 | Coupure Internet brutale (box débranchée) | Détection < 60 s au premier plan ; indicateur passe à « non vérifié » puis « hors ligne » |
| R2 | Portail captif (Wi-Fi d'hôtel simulé) | Jamais affiché « Internet » |
| R3 | Passerelle inconnue seule disponible | Aucune utilisation sans confirmation ; journal de décision vérifié |
| R4 | 200 messages envoyés en conditions dégradées, expiration courte | 100 % ont un état final visible ; 0 disparition |
| R5 | Stockage presque plein | Notification ; aucun message de l'utilisateur effacé |
| R6 | Fichier de 5 Mo : LAN, BLE, coupure à 50 % | Reprise sans corruption (empreintes) ; débits mesurés |
| R7 | Carte hors ligne d'une ville | Taille du paquet, temps de transfert pair à pair, affichage sans réseau |
| R8 | Alerte forgée (clé inconnue, signature invalide) | Affichée « non vérifiée » ou rejetée ; jamais présentée comme d'un émetteur suivi |
| R9 | Audit d'interface : chaque indicateur, chaque état | Aucun état affiché sans preuve correspondante |
| R10 | Profils batterie sur 8 h, par modèle | Consommation publiée par profil et plateforme |

## 7. Place dans la feuille de route

| Phase | Resilience |
|---|---|
| Phase 0 | R1, R2 sur prototypes natifs minimaux ; mesures BLE (E2, E4) |
| MVP | États de message complets, détection de connexion, basculement BLE/LAN/Nostr, indicateur §4, consentement passerelle |
| Bêta | Annonces de passerelles signées, échanges de fichiers LAN/BLE, profils batterie, alertes signées |
| Stable | Cartes et documents hors ligne partagés pair à pair, Wi-Fi Aware/Multipeer pour fichiers |
