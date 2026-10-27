# MESHORA Shield — Audit confidentialité, VPN et résilience numérique

> Version 0.1 — 25 octobre 2026 — rédigé par Claude (audit et architecture).
> Complète `AUDIT.md`, `ARCHITECTURE.md` et `SECURITY.md`. Même convention de preuve :
> **[S]** sourcé (liste en fin de document) · **[C]** connaissance du domaine non revérifiée ici · **[T]** à trancher par test sur appareil réel.
> Statut : **proposition non auditée.** Rien ici ne doit être présenté au public comme une garantie.

---

## 0. Réponse courte

1. **Oui, une couche VPN commune aux cinq systèmes est possible : c'est WireGuard.** Elle existe déjà sur Android, iOS, macOS, Windows et Linux avec des implémentations libres. MESHORA ne doit pas écrire de VPN : il doit **orchestrer** WireGuard.
2. **Le VPN et le mesh sont deux choses différentes et doivent le rester.** Le mesh transporte des *messages* (quelques Ko, en différé). Le VPN transporte du *trafic Internet* (interactif, volumineux). On ne fera pas passer de navigation web par Bluetooth ou LoRa : le débit ne le permet pas. Le lien entre les deux, c'est la passerelle.
3. **Sur iPhone, le VPN est la partie qui marche le mieux en arrière-plan** (le système maintient le tunnel), mais il est **unique** (un seul VPN actif à la fois), plafonné en mémoire (~50 Mo, ce qui rend Tor fragile [S]), et l'App Store **réserve les apps VPN aux développeurs inscrits comme organisation** [C, à revérifier].
4. **La simplicité vient d'un mode par défaut sans VPN.** Le niveau de protection de base (chiffrement de bout en bout des messages, DNS chiffré, aucune donnée centralisée) ne demande aucune configuration. Le VPN et Tor sont des **options explicites**, activées avec consentement.
5. **Recommandation bêta :** livrer un « Shield » volontairement petit — DNS chiffré, VPN personnel vers *sa propre* passerelle (appairage par QR), Tor optionnel pour la passerelle — et **aucune sortie Internet communautaire publique**.

---

## 1. Matrice des technologies

| Technologie | Fonction | Plateformes | Licence | Sans compte central ? | Verdict MESHORA |
|---|---|---|---|---|---|
| **WireGuard** | Tunnel VPN chiffré (Noise IK, Curve25519, ChaCha20-Poly1305) | Linux (noyau), Windows (wireguard-nt), macOS/iOS (wireguard-apple), Android (wireguard-android) [C] | GPL-2.0 (noyau) ; MIT/Apache pour les bibliothèques d'applications [C] | Oui (pairs déclarés par clés) | **Socle VPN retenu.** |
| **Tailscale** | Maillage WireGuard + coordination + NAT traversal + relais DERP | Toutes | Cœur BSD-3 ; interfaces graphiques iOS/macOS/Windows non libres [C] | Non (serveur de coordination SaaS) | Référence d'ergonomie, pas socle (service central, GUI fermées). |
| **Headscale** | Serveur de coordination Tailscale auto-hébergé | Serveur Linux ; utilise les clients Tailscale officiels via « serveur de coordination alternatif » [S] | BSD-3 [C] | Oui, si auto-hébergé | Option « réseau de la compagnie / du collectif ». Dépend des clients Tailscale (partiellement fermés). |
| **NetBird** | Maillage WireGuard + coordination + relais | Toutes | Clients **BSD-3** ; serveur de gestion, relais, signal et tableau de bord passés en **AGPL-3.0** au 5 août 2025 (v0.53.0) [S] | Oui, si auto-hébergé | **Meilleur candidat « tout libre »** pour un réseau privé de groupe. AGPL côté serveur = sans problème pour héberger, contraignant pour intégrer du code. |
| **Netmaker** | Maillage WireGuard orienté entreprise | Toutes | Serveur Apache-2.0 depuis sept. 2023 (avant : SSPL) ; métriques, bascule et gestion des utilisateurs réservées à l'édition Entreprise/SaaS [S] | Oui, si auto-hébergé | Écarté pour le grand public (orienté administration, fonctions clés hors version libre). |
| **Tor** (C) / **Arti** (Rust) | Anonymisation par circuits à 3 relais, services onion | Toutes ; sur iOS via Orbot (Tor en C dans une extension réseau) [S] | BSD-3 [C] ; Arti MIT/Apache [C] | Oui | **Option** pour masquer l'adresse IP des passerelles et des utilisateurs avancés. Fragile sur iOS (plafond mémoire, plantages de l'extension [S]). |
| **Ponts Tor** (obfs4, Snowflake, WebTunnel, meek) | Contournement de la censure | Selon client ; Orbot iOS : obfs4, Snowflake, ponts personnalisés [S] | Libre | Oui | À réutiliser tels quels ; ne pas créer de transport d'obfuscation maison. |
| **I2P** (Java / i2pd C++) | Réseau anonymisant à tunnels | Desktop, Android ; pas de client iOS sérieux connu [C] | Libre (divers) [C] | Oui | **Écarté** pour le grand public (pas d'iOS, démarrage lent). |
| **Yggdrasil** | Réseau IPv6 chiffré auto-organisé | Desktop, Android, iOS via extension réseau [C] | LGPL-3.0 [C] | Oui | Option expérimentale pour relier des passerelles entre elles. Pas d'anonymat. |
| **cjdns** | Idem, plus ancien | Linux surtout | GPL-3.0 [C] | Oui | Écarté (faible activité). |
| **Reticulum** | Pile réseau chiffrée multi-supports | Python, forks Rust | Licences fragmentées, mainteneur en retrait [S, voir AUDIT] | Oui | Pont côté passerelle uniquement (ARCHITECTURE ADR-5). |
| **libp2p** | Boîte à outils P2P (transports, NAT traversal, relais circuit) | Go, Rust, JS | MIT/Apache [C] | Oui | Possible pour l'échange entre passerelles ; trop lourd pour le mobile au MVP. |
| **DNS chiffré** (DoH RFC 8484, DoT RFC 7858, DoQ RFC 9250) | Chiffre les requêtes DNS | Natif : Android 9+ « DNS privé » (DoT) ; iOS/macOS profils DNS chiffrés et API `NEDNSSettings` [C] ; Windows 11 DoH [C] | Standards | Oui | **Retenu par défaut** sur les passerelles et dans le tunnel. |
| **Oblivious DoH** (RFC 9230) | Sépare « qui demande » de « ce qui est demandé » | Peu de résolveurs [C] | Standard | Oui | Option stable, pas bêta. |
| **DNSSEC** | Authentifie les réponses DNS | Validation par résolveur (Unbound) [C] | Standard | Oui | Validation sur la passerelle (Unbound). Ne chiffre rien : complémentaire du DNS chiffré. |
| **Obfuscation VPN** (AmneziaWG, WireGuard sur TCP/WebSocket, Shadowsocks…) | Échapper à l'inspection profonde qui reconnaît WireGuard | Variable | Variable [C] | Oui | **Stable seulement**, après étude juridique et test ; jamais activé par défaut. |

---

## 2. Modèle de menaces

### 2.1 Biens à protéger
Contenu des messages · identités et clés · carnet de contacts · adresse IP et localisation · historique de navigation (si VPN) · métadonnées (qui parle à qui, quand, combien) · disponibilité du service.

### 2.2 Adversaires et capacités

| Adversaire | Capacités réalistes | Protection MESHORA | Ce qui reste exposé |
|---|---|---|---|
| **Observateur radio local** | Écoute BLE/LoRa, triangulation | Chiffrement, identifiants BLE éphémères | Présence d'émetteurs, volumes, horaires, position approximative |
| **Opérateur réseau / FAI** | Voit IP de destination, DNS en clair, volumes | DNS chiffré, VPN vers sa passerelle, Tor en option | Le fait d'utiliser un VPN/Tor ; IP de sa propre passerelle |
| **Censeur étatique (inspection profonde, blocage)** | Bloque relais Nostr, signature WireGuard, IP de Tor | Multi-relais, ponts Tor, transports de secours, mesh local hors Internet | Un censeur déterminé bloque l'accès Internet ; le mesh local reste utilisable |
| **Surveillance ciblée** | Réquisitions auprès des opérateurs de passerelles, logiciel espion sur l'appareil | Chiffrement de bout en bout, absence de journaux | **Un appareil compromis compromet tout.** Hors de portée d'une application |
| **Relais communautaire malveillant** | Jette, retarde, rejoue, inonde, corrèle | SECURITY §4 | Corrélation de trafic par un relais qui voit beaucoup de flux |
| **Passerelle / sortie VPN malveillante** | Voit tout le trafic non chiffré au-delà du tunnel, l'IP de l'utilisateur | Pas de sortie publique par défaut ; HTTPS ; avertissements | Navigation non-HTTPS ; métadonnées vers la destination |
| **Voleur / perte d'appareil** | Accès physique | Chiffrement au repos, verrouillage, révocation de clé d'appareil (SECURITY §2) | Appareil déverrouillé au moment du vol |
| **Contact malveillant** | Capture d'écran, transfert | Aucun (limite humaine) | Contenu partagé |
| **Chaîne de fabrication compromise** | Mise à jour piégée | Signatures, builds reproductibles (stable), SBOM | Phase bêta : confiance dans les mainteneurs |
| **Coupure de réseau** | Panne, catastrophe, coupure volontaire | Mesh local, stockage-relais, synchro différée | Pas d'Internet = pas de navigation ; seul le message court passe |

### 2.3 Hypothèses explicites
- MESHORA **ne promet aucun anonymat absolu**. Tor réduit l'exposition de l'IP ; il ne protège pas d'un adversaire global ni d'une erreur d'usage.
- Le système d'exploitation et le matériel sont supposés sains.
- Aucun relais, passerelle ou sortie communautaire n'est fiable par défaut.

---

## 3. Architecture VPN / mesh

```
 Téléphone / ordinateur                              Passerelle personnelle (Pi, PC)
┌──────────────────────────────┐                   ┌────────────────────────────────┐
│ App MESHORA                  │                   │ meshora-gateway                │
│  ├─ Messagerie (cœur Rust)   │◄─ BLE / LAN ─────►│  ├─ Relais messages            │
│  │   messages chiffrés E2E   │   (mesh local)    │  ├─ Synchro Nostr (via Tor opt.)│
│  │                           │                   │  ├─ Résolveur Unbound          │
│  └─ Shield (optionnel)       │                   │  │   DNSSEC + DoT/DoH sortant   │
│      tunnel WireGuard ───────┼── Internet ──────►│  └─ Terminaison WireGuard      │
│      DNS chiffré dans le     │   (UDP, ou TCP    │      sortie Internet = la box  │
│      tunnel                  │    obfusqué en    │      de l'utilisateur          │
└──────────────────────────────┘    stable)        └────────────────────────────────┘
```

### 3.1 Trois niveaux, activés séparément
| Niveau | Contenu | Activation | Configuration |
|---|---|---|---|
| **Base** (toujours) | Messages chiffrés de bout en bout, aucune donnée centralisée, DNS chiffré pour le trafic propre à MESHORA | Par défaut | Aucune |
| **Maison** | Tunnel WireGuard vers **sa propre** passerelle : navigation protégée sur Wi-Fi publics, accès au mesh de la maison à distance | Consentement explicite à l'activation | Scanner un QR affiché par la passerelle |
| **Avancé** | Tor (Arti) pour la passerelle ; ponts anti-censure ; réseau de groupe (NetBird ou Headscale auto-hébergé) | Réglages avancés, désactivables | Guidée, documentée |

### 3.2 Appairage sans compte central
1. La passerelle génère sa paire de clés WireGuard et affiche un QR contenant : clé publique, adresses de contact (IP publique, nom DNS dynamique, adresse onion optionnelle), signature par l'identité MESHORA du propriétaire.
2. L'app vérifie que la signature correspond à **l'identité de son propre utilisateur** (ou d'un contact vérifié), crée sa clé WireGuard, et transmet sa clé publique à la passerelle **par le mesh** (BLE/LAN) — pas par un serveur.
3. Résultat : un VPN personnel sans compte, sans serveur de coordination, sans tiers.
4. Accès depuis l'extérieur derrière une box sans IP publique : redirection de port (guide), ou relais chiffré auto-hébergé, ou adresse onion (avancé). Pas de relais public MESHORA au MVP. [T : taux de réussite réel chez des utilisateurs non techniciens]

### 3.3 Combinaison VPN + mesh + passerelles (question 2)
- **Le mesh n'utilise pas le VPN** : il fonctionne sans Internet et chiffre déjà ses messages.
- **La passerelle fait le pont** : elle reçoit les messages par le mesh local et les synchronise via Nostr ; elle termine aussi le VPN.
- **Le VPN peut transporter la synchro** : un téléphone en 4G avec le tunnel actif rejoint sa passerelle, donc son mesh domestique, à distance.
- **Groupes** (compagnie, collectif) : plusieurs passerelles reliées en WireGuard (NetBird auto-hébergé ou configuration statique). Les messages circulent entre sites par ces liens.

### 3.4 Sélection automatique des transports (question 4)
Un **gestionnaire de transports** dans le cœur :
- Sonde l'état de chaque transport (voisins BLE, LAN, Internet réel vérifié auprès d'un relais, pas seulement « Wi-Fi connecté »).
- Politique par type de message : un message direct part **en parallèle** par tous les chemins disponibles (BLE + Nostr), la déduplication par identifiant évite les doublons ; un fichier ne prend que les chemins à haut débit.
- Repli ordonné pour Internet : direct → via VPN maison → via Tor → via ponts Tor → attente et stockage-relais.
- WireGuard gère nativement le changement d'IP (itinérance) [C] ; la passerelle publie plusieurs points d'accès (IPv4, IPv6, onion).
- Aucune bascule n'est silencieuse vers un mode **moins** protecteur : si Tor tombe, l'app passe en attente plutôt qu'en connexion directe, sauf réglage contraire choisi par l'utilisateur.

### 3.5 Intégrer des réseaux existants sans les affaiblir (question 5)
- **Jamais de déchiffrement-rechiffrement** dans un pont : l'enveloppe MESHORA traverse Meshtastic, Nostr ou Reticulum *chiffrée*, comme une charge opaque.
- **Pas de clé partagée entre réseaux** : chaque réseau a ses clés ; MESHORA les lie par attestation signée.
- **Ponts isolés** : chaque pont tourne dans un processus séparé avec le minimum de droits (sur Linux : utilisateur dédié, systemd sandboxing).
- **Respecter le modèle de chaque réseau** : pas d'injection dans un canal Meshtastic public de contenu qui n'y est pas destiné ; respect du temps d'antenne.
- **NetBird / Headscale** : MESHORA ne remplace pas leur client ; il documente leur usage et, plus tard, peut lire leur état.

---

## 4. Fuites DNS, IP et métadonnées (question 3)

| Fuite | Cause typique | Contre-mesure | Test |
|---|---|---|---|
| DNS hors tunnel | DNS du système ou de la box utilisé malgré le VPN | DNS forcé dans le tunnel (résolveur de la passerelle) ; `NEDNSSettings` sur Apple, DNS du `VpnService` sur Android [C] | S1 |
| IPv6 hors tunnel | Tunnel IPv4 seul, IPv6 natif actif | Tunnel double pile, ou blocage IPv6 hors tunnel | S2 |
| Trafic avant / après tunnel | Connexions ouvertes avant l'activation, coupure du tunnel | Coupe-circuit : Android « VPN permanent » + « bloquer les connexions sans VPN » [C] ; Apple `includeAllNetworks` [C] | S3 |
| **Fuites système connues** | iOS : certains services Apple et connexions existantes peuvent contourner le tunnel ; Android : vérifications de connectivité hors VPN même en mode verrouillé [C, rapports publics de fournisseurs VPN 2020–2022] | Documenter, tester à chaque version d'OS, **ne pas promettre l'étanchéité totale** | S4 [T] |
| WebRTC / navigateur | Le navigateur révèle l'IP locale | Hors périmètre de l'app ; avertissement dans le guide | — |
| Métadonnées mesh | Étiquettes, horaires, volumes | Étiquettes rotatives, remplissage (« padding ») des messages à tailles fixes, envoi groupé optionnel | S5 |
| Métadonnées Nostr | Le relais voit l'IP de la passerelle et ses abonnements | Plusieurs relais, NIP-59, Tor optionnel côté passerelle | S6 |
| Journaux | Logs de débogage contenant des identifiants | Journaux locaux uniquement, anonymisés, désactivés en production ; **aucun journal de navigation**, jamais envoyé | Revue de code |
| Rapports de plantage / analytique | SDK tiers | **Aucun SDK d'analytique ni de rapport de plantage tiers** | Analyse des dépendances |

---

## 5. Compatibilité par plateforme

| Fonction | iPhone / iPad | Android | macOS | Windows | Linux / Pi |
|---|---|---|---|---|---|
| Tunnel WireGuard | ✅ extension `NEPacketTunnelProvider` [C] | ✅ `VpnService` [C] | ✅ extension réseau | ✅ wireguard-nt | ✅ noyau |
| Tunnel actif en arrière-plan | ✅ maintenu par le système [C] | ✅ | ✅ | ✅ | ✅ |
| Plusieurs VPN simultanés | ❌ un seul tunnel actif [C] | ❌ un seul `VpnService` [C] | 🟡 | 🟡 | ✅ |
| Coupe-circuit fiable | 🟡 `includeAllNetworks`, fuites connues [C/T] | 🟡 mode verrouillé, vérifications système hors tunnel [C/T] | 🟡 | 🧪 | ✅ (pare-feu nftables) |
| VPN permanent imposé | ❌ seulement sur appareils supervisés (MDM) [C] | ✅ réglage utilisateur | 🟡 | 🟡 | ✅ |
| Tor intégré | 🟡 fragile : plafond mémoire ~50 Mo de l'extension, plantages et redémarrages [S] | ✅ (Orbot, Arti) | ✅ | ✅ | ✅ |
| Ponts anti-censure | 🟡 obfs4, Snowflake via Orbot [S] | ✅ | ✅ | ✅ | ✅ |
| DNS chiffré système | ✅ profils / `NEDNSSettings` [C] | ✅ DNS privé (DoT) [C] | ✅ | ✅ DoH (Win 11) [C] | ✅ (systemd-resolved, Unbound) |
| Relais BLE depuis l'extension VPN (pour contourner les limites d'arrière-plan) | ❌ probable : Core Bluetooth non prévu dans une extension réseau [T] | n/a | n/a | n/a | n/a |
| I2P | ❌ | 🟡 | ✅ | ✅ | ✅ |
| Rôle passerelle / sortie | ❌ | 🟡 (batterie) | ✅ | ✅ | ✅ **recommandé** |

### Ce qui fonctionne réellement sur iPhone (question 8)
- **Oui, de façon fiable :** tunnel WireGuard en arrière-plan ; DNS chiffré ; messagerie au premier plan ; synchro Nostr à l'ouverture.
- **Oui, avec limites :** Tor (plantages possibles de l'extension) ; relais BLE en arrière-plan (voir AUDIT §4) ; réveils périodiques non garantis.
- **Non :** relais après fermeture par l'utilisateur ; deux VPN simultanés (conflit avec le VPN d'entreprise ou un VPN commercial de l'utilisateur) ; VPN imposé sans MDM ; I2P.
- **Conséquence produit :** sur iPhone, Shield est une **option qui remplace** le VPN existant de l'utilisateur. L'app doit le dire avant activation.

---

## 6. Simplicité d'usage (question 6)

- **Zéro réglage pour le niveau Base.** Pas de compte, pas de serveur à choisir, pas de vocabulaire technique au premier lancement.
- **Une action pour le niveau Maison** : « Scanner le code de ma passerelle ». L'image de passerelle (Pi) démarre et affiche son QR sur un écran ou une page locale.
- **États lisibles, jamais de faux sentiment de sécurité** : « Protégé par ta passerelle », « Connexion directe (non protégée) », « Tor : connexion en cours ».
- **Consentement explicite et réversible** : l'écran système de création de VPN est précédé d'un écran MESHORA qui explique ce qui change ; un seul bouton pour tout désactiver.
- **Permissions minimales et demandées au moment utile** : Bluetooth à la première recherche de voisins, VPN à l'activation de Shield, jamais de localisation, de contacts, de micro.
- **Aucune option avancée visible par défaut** ; elles sont regroupées et désactivables.

---

## 7. Relais communautaires et passerelles inconnues (question 7)

| Risque | Gravité | Recommandation |
|---|---|---|
| Une sortie Internet communautaire voit le trafic non chiffré et l'IP de l'utilisateur | Élevée | **Pas de sortie publique au MVP ni en bêta.** Sortie uniquement via sa propre passerelle ou celle d'un groupe explicitement choisi |
| Responsabilité juridique de l'opérateur d'une sortie | Élevée | En France, fournir un accès à Internet au public peut entraîner des obligations de conservation des données de connexion [C — **avis juridique requis**]. MESHORA ne doit pas transformer ses utilisateurs en fournisseurs d'accès à leur insu |
| Corrélation de trafic par un relais très central | Moyenne | Diversité des chemins ; Tor pour les cas sensibles |
| Relais qui jette ou retarde | Moyenne | Multi-chemins, accusés |
| Passerelle qui ment sur son état (« en ligne ») | Faible | Vérification de bout en bout par accusé |
| Liste de relais Nostr empoisonnée | Moyenne | Liste par défaut signée, modifiable, jamais remplacée par un tiers à distance |
| Faux QR de passerelle | Élevée | Signature par l'identité vérifiée du propriétaire ; refus sinon |

---

## 8. Distribution : coûts et contraintes (question 9)

| Canal | Coût | Contraintes spécifiques VPN / chiffrement |
|---|---|---|
| **App Store** (iOS, macOS) | 99 €/an | Apps VPN : API `NEVPNManager`/extension, **compte développeur au nom d'une organisation** (guideline 5.4) [C — à vérifier dans les règles en vigueur ; nécessite un numéro D-U-N-S, gratuit] ; déclaration d'export du chiffrement ; retraits possibles par pays (précédent Bitchat, Chine) [S] |
| **Google Play** | 25 $ une fois | Déclaration d'usage de `VpnService` et politique de confidentialité [C] ; restrictions de services au premier plan |
| **F-Droid** | Gratuit | Code entièrement libre, sans dépendance Google, build depuis les sources [C] ; cohérent avec la licence choisie |
| **APK direct / Obtainium** | Gratuit | Signature et canal de mise à jour à sécuriser soi-même |
| **AltStore / magasins alternatifs (UE)** | Variable | Possible dans l'UE (DMA) [C] ; filet de sécurité en cas de retrait de l'App Store |
| **Windows** | Certificat de signature de code : ~100–400 €/an, ou service de signature cloud [C] | Sans signature : alertes SmartScreen (constaté sur tes autres projets) |
| **macOS hors App Store** | Inclus dans les 99 €/an (notarisation) | Extension réseau à faire approuver par l'utilisateur |
| **Linux** | Gratuit | Flatpak, .deb, image Raspberry Pi |

Point d'organisation : la compagnie (structure juridique existante) pourrait porter le compte Apple « organisation ». À trancher tôt : le délai d'obtention du D-U-N-S et de validation Apple se compte en semaines [C].

---

## 9. Plan de tests

### 9.1 Tests internes (avant toute bêta publique)
| Id | Test | Méthode | Critère |
|---|---|---|---|
| S1 | Fuite DNS | Capture sur la box (tcpdump/Wireshark) pendant navigation via tunnel | Aucune requête DNS en clair hors tunnel |
| S2 | Fuite IPv6 | Réseau double pile, sites de test IPv6 | Aucune connexion IPv6 hors tunnel |
| S3 | Coupe-circuit | Couper la passerelle, basculer Wi-Fi ↔ 4G, mode avion | Aucun paquet hors tunnel en mode verrouillé, ou écart documenté |
| S4 | Fuites système iOS/Android | Capture côté réseau, chaque version majeure d'OS | Écarts listés et publiés |
| S5 | Métadonnées mesh | Capture BLE (sniffer nRF52) | Pas d'identifiant stable > 15 min ; tailles uniformes |
| S6 | Relais Nostr hostile | Relais modifié qui journalise | Seules les informations prévues au §4 sont visibles |
| S7 | Faux QR / faux pair | QR forgé, clé non signée | Refus systématique |
| S8 | Relais hostile (rejeu, inondation, altération) | Nœud modifié | Rejets et quotas conformes (SECURITY §4) |
| S9 | Perte d'appareil | Révocation depuis un autre appareil, hors ligne puis en ligne | Clé révoquée propagée, accès VPN coupé |
| S10 | Bascule de transports | Coupures aléatoires scriptées | Jamais de repli silencieux vers moins protecteur |
| S11 | Tor sur iOS | 24 h, réseau variable | Taux de plantage de l'extension mesuré |
| S12 | Utilisabilité | 10 personnes non techniciennes, sans aide | ≥ 8 activent le mode Maison ; 0 croit être protégée quand elle ne l'est pas |
| S13 | Fuzzing | `cargo-fuzz` sur parseurs CBOR, QR, protocoles | 0 plantage sur 24 h de fuzzing par cible |
| S14 | Dépendances | SBOM, `cargo-audit`, `cargo-deny` dans la CI | Aucune vulnérabilité connue non traitée |

### 9.2 Tests indépendants obligatoires avant diffusion publique (question 10)
1. **Audit cryptographique et protocolaire** du cœur (enveloppe, identités, appairage QR, intégration WireGuard/Noise) par un cabinet indépendant.
2. **Test d'intrusion des applications** iOS, Android et de l'image passerelle (stockage local, permissions, surface réseau exposée de la passerelle).
3. **Revue du modèle de menaces** par une organisation de défense des libertés numériques ou des chercheurs extérieurs.
4. **Revue de confidentialité** : permissions, données collectées (objectif : aucune), conformité RGPD de la documentation.
5. **Revue juridique** : sorties Internet, chiffrement, distribution par pays.
6. **Publication** des rapports et des correctifs, puis programme de signalement de vulnérabilités (adresse dédiée, `SECURITY.txt`, délai de divulgation coordonnée).
Pistes de financement : NLnet / NGI Zero, Open Technology Fund (audits via ses laboratoires partenaires), OSTIF [C — éligibilité à vérifier].

---

## 10. Recommandations pour une bêta sécurisée

**À faire (bêta) — volontairement peu :**
1. Niveau Base par défaut, sans configuration.
2. Mode Maison : WireGuard vers sa propre passerelle, appairage QR signé, DNS chiffré et DNSSEC sur la passerelle.
3. Tor (Arti) optionnel **côté passerelle** pour la synchro Nostr ; pas de Tor intégré dans l'app iOS en bêta.
4. Coupe-circuit actif quand Shield est activé ; états affichés honnêtement.
5. Aucune sortie Internet publique ; aucun relais considéré fiable ; aucun SDK tiers ; aucun journal de navigation.
6. Tests S1 à S14 réussis ou écarts publiés ; audit externe lancé avant l'ouverture publique.

**À ne pas faire en bêta :**
- Écrire un VPN, un transport d'obfuscation ou une primitive cryptographique.
- Proposer des sorties communautaires ou un « VPN gratuit pour tous ».
- Promettre l'anonymat, l'étanchéité totale ou le fonctionnement en toute circonstance.
- Activer quoi que ce soit côté VPN sans consentement explicite.

**Plus tard (stable) :** réseaux de groupe NetBird/Headscale intégrés, ponts Tor et obfuscation WireGuard pour pays censurés (après étude juridique), Oblivious DoH, builds reproductibles.

---

## 11. Coordination avec le prototype Google AI Studio (non bloquante)

Le prototype peut avancer dès maintenant sur l'interface ; il ne doit rien implémenter de cryptographique ni de réseau réel. Éléments d'interface à prévoir :
1. Écran de consentement avant toute activation de Shield (ce qui change, comment désactiver).
2. Indicateur d'état permanent : transport utilisé, « chiffré de bout en bout », « protégé par ta passerelle » / « connexion directe ».
3. Parcours « Scanner le code de ma passerelle » (simulé).
4. Réglages avancés repliés par défaut, chacun désactivable.
5. Aucun interrupteur qui ne correspond à rien de réel : les fonctions non implémentées sont marquées « bientôt », pas simulées comme actives.

---

## Sources consultées (25 octobre 2026)

- NetBird, annonce du passage partiel à l'AGPL : https://netbird.io/knowledge-hub/netbird-agpl-announcement
- Netmaker, passage à Apache-2.0 : https://netmaker.io/resources/netmaker-goes-open-source-why-we-switched-to-apache-2-0
- Headscale, configuration des clients Apple : https://git.laurivan.com/Mirrors/juanfont.headscale/src/commit/2055f3d3a8805d5f11ffb2f0d8af39f52cfb4a26/docs/apple-client.md
- Orbot, FAQ (plafond mémoire des extensions réseau iOS, ponts) : https://orbot.app/br/faqs
- Forum Apple, limite mémoire `NEPacketTunnelProvider` (non documentée officiellement) : https://developer.apple.com/forums/thread/728876
- Wikipédia, BitChat (retrait de l'App Store chinois) : https://en.wikipedia.org/wiki/BitChat

Points [C] à sourcer en priorité : texte actuel de la guideline App Store 5.4 (VPN / organisation) ; documentation Apple `includeAllNetworks` et fuites connues ; politique Google Play sur `VpnService` ; obligations françaises de conservation des données pour un accès Internet ouvert au public ; licences exactes des clients Tailscale.
