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


## État du code (2026-10-28)

Application Next.js 16 qui fonctionne (tests verts, build OK). Mise en ligne : `DEPLOY.md` § 5.

**Ce qui marche :**
- **Commun (kit Suite TAKATAK, identique dans les 9 apps)** : connexion Clover OAuth v2 (jetons scellés, rafraîchis
  seuls, supprimés à la désinstallation) · webhook Clover (vérification, X-Clover-Auth, chaque événement une fois) ·
  base PostgreSQL (ou mémoire en dev) · session marchand · paliers Base / Premium / VIP lus depuis la facturation
  Clover (`OWN_MERCHANTS` = VIP) · marchand `RNVTBYMCKXEJ1` en lecture seule · lien Suite TAKATAK avec Food Hub ·
  page d'accueil FR/EN, tableau de bord `/app`, pages légales `/legal/*`, `/api/health`, `/api/cron`, clés d'appareils.
- Livre du jour depuis les paiements Clover : brut, ventes nettes, TPS / TVQ séparées (par les taux du paiement,
  sinon 5 : 9,975 marqué « estimé »), autres taxes, pourboires, remboursements, modes de paiement
- Rapport par période (Base ≤ 31 jours, VIP illimité) et export CSV pour le comptable
- Ventes des plateformes (Uber Eats, DoorDash, Skip…) reçues de Food Hub, à part

**Ce qui reste :**
- Rapprochement versements vs ventes, passif REW4RDS et coûts ST4FF intégrés (Premium) — les données existent dans
  ces apps et passent par la suite ; reste à les afficher ici.
- Ce n'est pas un SEV/MEV : les reçus Revenu Québec restent le travail de TAKATAK MEV (QCMEV.CA).

**Développer :** `npm install` · `npm run dev` · `npm run typecheck` · `npm test` · `npm run build`. Règles pour
les agents : `AGENTS.md` ; journal : `WORKLOG.md`.
