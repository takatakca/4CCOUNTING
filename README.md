# 4CCOUNTING by TAKATAK

**App ID Clover (production) :** `VQTZE8C31D8MW`
**Développeur :** TAKATAK (compte développeur Clover 9KJ25ATT15TTW)
**État au portail :** brouillon (draft) — rien de soumis.
**Dépôt :** takatakca/4CCOUNTING

## Ce que fait l'app

Comptabilité du marchand Clover : ventes, taxes TPS/TVQ ventilées, pourboires, modes de paiement, passif cartes-cadeaux (REW4RDS) et coûts de main-d'œuvre (ST4FF) — rapports et exports prêts pour le comptable.

## Paliers (doctrine de prix de Matt, 2026-10-28)

Chaque app a SES propres paliers. Base = le nécessaire essentiel · Premium = plus d'avantages · VIP = le full kit, tout ce que Clover offre pour la catégorie.

- **Base 50 $/mois** — rapport de fin de journée depuis Orders/Payments, ventilé par taux de taxe (TPS 5 % / TVQ 9,975 % séparés), modes de paiement et pourboires ; export CSV.
- **Premium 100 $/mois** — + rapprochement versements vs ventes avec écarts signalés ; passif cartes-cadeaux REW4RDS intégré ; coûts de main-d'œuvre ST4FF ; multi-succursales consolidé ; événements de caisse dans le rapprochement.
- **VIP 150 $/mois** — full kit : capture fiscale complète style MEV (chaque vente reconstituée : articles, taxes, pourboire, tender, appareil, opérateur) ; écritures prêtes à importer ; alertes d'anomalies en continu (webhooks) ; historique illimité par plages de dates.

Prix facturés via les plans d'abonnement du Clover App Market (à créer au portail — voir DEPLOY.md).

## Permissions Clover visées

Orders R · Payments R · Merchant R · Employees R · Inventory R

## Structure

- `docs/listing/` — fiche marketplace (description FR/EN) et textes légaux, depuis le package de soumission local (`~/workspace/clover-apps/`)
- `app/api/clover/` — points d'entrée webhook + OAuth (scaffold, même patron que Food Hub)
- `lib/clover/config.ts` — configuration par variables d'environnement (aucun secret dans le code)
- `config/app.config.json` — identité de l'app et paliers
- `DEPLOY.md` — ce qui reste à faire, étape par étape, pour la vague portail

## Le système unique TAKATAK

Cette application fait partie de la suite TAKATAK sur Clover : toutes les apps partagent le même dos d'événements (webhooks Clover), le même **client unique reconnu par son numéro de téléphone** (+ courriel), et les mêmes commandes et paiements Clover. Aucune app ne vit en silo : les données qu'elle produit alimentent les autres apps de la suite (voir « Clover API — Main Stuff — Robot Notepad », section 3, déposé au Drive Opérations et dans `~/workspace/clover-apps/`).

