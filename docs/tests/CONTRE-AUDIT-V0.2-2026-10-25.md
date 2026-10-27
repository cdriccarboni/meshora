# Rapport d'essais — contre-audit V0.2 (25 octobre 2026)

Analyse : `docs/audits/CONTRE-AUDIT-V0.2.md`. Ce rapport ne contient que les conditions et les résultats bruts.

## Conditions

| | |
|---|---|
| Machine | Mac M4 (macOS), une seule machine |
| Logiciels | Node 24.21.0, Python 3.9.6, Google Chrome (Playwright `playwright-core` 1.56.1, sans tête) |
| Code | `validation/v0.2-contre-audit` ; comparaison avec `ai-studio/prototype-v0` @ `9965e5e` |
| Réseau | Boucle locale (127.0.0.1) uniquement. **Aucun essai entre appareils, aucun essai sur téléphone, aucun essai radio.** |

## Commandes

```sh
cd prototype && npm ci --ignore-scripts
npx tsc --noEmit
npm test                                   # unitaires + hygiène d'adresse + intégration
npx tsx ../tools/audit/run.ts              # banc applicatif T1–T9
node ../tools/audit/relay-dos.mjs          # T10
npm run build && cd .. && python3 scripts/build_site.py
NODE_PATH=<dossier>/node_modules node tools/audit/browser.mjs   # B1–B5 (playwright-core + Chrome)
```

## Résultats

| Suite | `9965e5e` | Branche de validation |
|---|---|---|
| `tsc --noEmit` | 0 erreur | 0 erreur |
| Unitaires (`tests/run-cli.ts`) | 13/13 | 13/13 |
| Hygiène d'adresse | — | 12/12 |
| Intégration (`tests/real-two-clients.test.ts`) | 9/9 | 9/9 (adaptée au HELLO authentifié) |
| Banc applicatif T1–T9 | 1/9 | 9/9 |
| T10 (trame de 1 Gio) | échec : 48 → 1800 Mio, connexion maintenue | succès : fermeture 1009, +1 Mio (3 exécutions) |
| Navigateur B1–B5 | non exécuté | 7/7 |
| `vite build` / `build_site.py` | OK / OK | OK / OK |

Sorties détaillées (branche de validation) :

```
T1 B reçoit=true ; statut chez A=delivered ; texte visible par le relais=false
T2 texte visible par le relais=false
T3 statut avant=sent ; après accusé forgé=sent
T4 message déchiffré par l'usurpateur=false ; reçu par le vrai Bob=true ; statut chez A=delivered
T5 retiré par un tiers=false ; reçu ensuite par Bob=true
T6 reçu par B=true ; statut chez A=delivered ; dans l'Outbox de A=false
T7 statut pendant la coupure=queued ; après reconnexion=delivered ; reçu par B=true
T8 trame non masquée traitée=false
T9 connexion acceptée depuis une origine étrangère=false
T10 Mio envoyés=1 ; connexion coupée par le relais=true ; mémoire du relais : 49 → 50 Mio (+1)
B1 reçu dans l'onglet B=true
B2 A→B reçu=true ; « Délivré » chez A=true ; B→A reçu=true
B3 adresse affichée=http://127.0.0.1:8810/app/?room=atelier#messages
B3b adresse affichée=http://127.0.0.1:8810/fr/decouvrir/?x=1
B4 demande affichée=true ; relais enregistré après refus=null
B5-mobile taille=40×40 ; bas du bouton=768 / haut de la nav=783 ; dégradé=false ; animation=none ; dialog nommé=true ; lien tel:112=1 ; focus piégé=true ; Échap ferme=true ; focus rendu=true
B5-desktop taille=40×40 ; bas du bouton=724 / haut de la nav=739 ; idem
```

Captures : `docs/tests/captures-v0.2/` (B2 ordinateur et mobile ; B5 bouton et fenêtre, mobile et ordinateur).

## Non réalisé (à faire avant toute annonce)

Mac ↔ téléphone sur le même Wi-Fi ; réseaux différents ; Safari iOS ; Android Chrome ; réception différée sur appareil réel ; BLE.
