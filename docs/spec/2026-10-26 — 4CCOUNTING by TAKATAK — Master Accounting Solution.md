# 2026-10-26 — 4CCOUNTING by TAKATAK — Master Accounting Solution

**Produit :** 4CCOUNTING by TAKATAK — le système comptable TOUT-EN-UN du groupe TAKATAK.
**Prix : 50 $/mois par entreprise** (standard de la suite TAKATAK, décision de Matt, 2026-10-26).
**Base de départ :** dépôt GitHub existant **takatakca/Facturations** (JavaScript) — le noyau de facturation déjà construit.
**Statut de ce document :** blueprint maître. Il décrit ce qui EXISTE déjà dans Facturations (lu directement dans le dépôt le 2026-10-26) et ce qui doit être bâti, par phase. Rien ici n'autorise une émission réelle, un envoi réel ou un déploiement : les gates du dépôt d'origine continuent de s'appliquer.

---

## 1. Vision

**Un seul système comptable pour tout le groupe.** Quadro Holdings Ltée et chacune de ses entreprises — les marques de restaurants (Café Bolon, Pi Pita, OOEUF, PPP Pizzeria, Po Poulet, Viennoise, BMBD — Bin Molle & Bin Dure, Taco Mexicano, O'Crêpe, Nutrition Shake, Délices d'Aden…), chaque emplacement (NDG — 6280 Somerled ; Saint-Léonard — 5839 Jean-Talon E), Rapide 2 Nette et TAKATAK Marketing — partagent la même plateforme, avec :

- **Multi-entreprises réel** : chaque entreprise a ses livres, son plan comptable, ses numéros d'enregistrement de taxes, ses comptes bancaires ; le groupe voit le consolidé sans jamais mélanger les écritures entre entreprises (isolation stricte, comme le socle Facturations l'exige déjà avec `business_id` vérifié sur chaque accès).
- **Multi-emplacements** : les ventes se détaillent par restaurant/adresse à l'intérieur d'une entreprise.
- **Français d'abord (fr-CA)**, anglais complet : interfaces, factures, courriels et PDF bilingues — l'ADN du socle actuel.
- **Le comptable travaille une fois** : une vente Clover, un rapport DoorDash, une facture fournisseur ou une feuille de temps ST4FF entrent une seule fois et alimentent le grand livre, les rapports de taxes, le food cost et le tableau de bord.
- **Preuve avant tout** : hérité de Facturations — chaque document officiel est immuable, versionné, haché, avec chaîne de provenance et journal d'audit append-only. 4CCOUNTING ne régresse jamais là-dessus.
- **Produit de la suite TAKATAK** : 4CCOUNTING se connecte nativement aux autres solutions de la suite — Clover (ventes), ST4FF (heures/paie), Food Hub (commandes plateformes), Fidélité Reward — et se vend aux marchands Clover à **50 $/mois par entreprise** sur le Clover App Market, comme les autres solutions de la suite.

## 2. Le socle actuel — ce qui existe déjà dans `takatakca/Facturations`

Lu directement dans le dépôt (README.md, package.json, arbres `src/`, `db/`, `docs/`, `docs/product-blueprint.md`, branche `main`) le 2026-10-26. **Le dépôt lui-même le déclare : application en développement, NON déployée — aucune facture réelle ne doit être émise à ce stade.** Ni le site `facturations.bolon.ca` ni un compte Wave réel n'ont été homologués.

### 2.1 Ce qui est construit et vérifié dans le code

| Domaine | État réel dans le dépôt |
|---|---|
| **Pile technique** | Node.js ≥ 20.11, CommonJS, **une seule dépendance : `pg`** (PostgreSQL 16). Base de données dédiée, 46 migrations SQL verrouillées (001–046) avec lock d'intégrité append-only. |
| **Authentification du personnel** | Connexion privée FR/EN, mot de passe + **MFA TOTP**, sessions révocables, cérémonie de récupération MFA hors HTTP, limites de tentatives. |
| **Brouillons de factures** | Espaces de travail avec **autosauvegarde serveur après 3 s + révisions**, éditeur mobile FR/EN, recherche et historique ; aperçu calculé **en cents, CAD seulement, taxes explicitement saisies — aucune décision fiscale automatisée**. |
| **Chaîne d'émission contrôlée** | Brouillon → conversion en **brouillon immuable PostgreSQL** → **approbation interne OWNER** → **autorisation d'émission distincte** (`AUTHORIZED_PENDING_PROVIDER`, immuable et idempotente). À ce stade : `issued=false`, `waveSynced=false`, `emailed=false`. |
| **Connecteur Wave** | Lecture seule aujourd'hui (liste des entreprises avec jeton autorisé). `wave-issuance-preflight.js` construit un **plan local sans réseau** après vérification stricte des mappings client/produits/taxes et **refuse les rabais par ligne** plutôt que de les approximer. Aucun appel Wave en écriture : l'adapter est injecté. |
| **Tentatives fournisseur** | Machine d'état persistée `PREPARED / IN_PROGRESS / AMBIGUOUS / CONFIRMED / FAILED` ; un état ambigu bloque tout nouvel appel jusqu'à réconciliation explicite (jamais de double émission silencieuse). |
| **Registre des factures émises** | Registre local append-only pouvant matérialiser `ISSUED_CONFIRMED` avec l'identifiant fournisseur et le numéro officiel ; le brouillon source reste `DRAFT`. (Le dépôt précise : ce registre local ne constitue pas à lui seul une preuve indépendante qu'une facture existe chez Wave.) |
| **PDF officiels** | Archive PDF bilingue **déterministe, hachée SHA-256, stockée en `bytea`** ; profils d'émetteur légaux/fiscaux **OWNER-vérifiés, versionnés, append-only** (aucune donnée inventée) ; PDF « qualifié » lié à une version exacte du profil émetteur avec hash de provenance. |
| **Livraison courriel** | Autorisation OWNER distincte qui fige le PDF qualifié exact, son SHA-256 et le destinataire exact ; tentatives persistées avec journal de transitions ; adapter actuel = **`SIMULATED_EMAIL`** seulement ; reçus de livraison append-only limités à `SIMULATED_ADAPTER_ONLY`. |
| **Preuves de remise courriel** | Ledger append-only des preuves fournisseur — aujourd'hui `SYNTHETIC_TEST` seulement ; ingestion `SIGNED_WEBHOOK` construite via une barrière de vérification de webhook signé (SHA-256 du body conservé) ; projection lecture seule `hasDelivered / hasBounced / hasComplaint` (`ACCEPTED` n'est jamais traité comme `DELIVERED`). |
| **Paiements Stripe** | Les paiements Stripe Checkout d'une facture émise deviennent une preuve `VERIFIED_PROVIDER_WEBHOOK` via `POST /webhooks/stripe/payments`, uniquement après vérification de la signature Stripe par Facturations (migration 046). Ledger de preuves paiement/remboursement avec filiation stricte (un remboursement doit pointer vers un paiement existant de la même facture) et garde anti double-comptage. |
| **Répertoire clients** | Répertoire privé OWNER FR/EN : recherche, pagination, **ajout de clients et correction de coordonnées** avec révisions et journal — les copies immuables des brouillons ne changent jamais quand le répertoire est corrigé. |
| **Portail client** | Activation **passwordless** en deux étapes (magic link à usage unique, le GET ne consomme pas le token), cookie client séparé, liste/détail des factures publiées, statut financier, téléchargement du PDF qualifié ; publication au portail par autorisation/révocation append-only. |
| **Assistant IA / voix** | Contrat de sécurité **provider-neutral** : sorties structurées strictes, **aucune exécution directe**, actions sensibles renvoyées vers les gates OWNER, blocage prompt-injection / multi-actions / ambiguïté. C'est le mécanisme de « préparation de factures assistée par IA » : l'assistant propose des champs structurés, l'OWNER confirme. |
| **Exploitation** | `/health` (processus) vs `/ready` (PostgreSQL, 503 en arrêt gracieux), garde de bord production (Host + HTTPS transféré, HSTS), identifiants de corrélation, événements JSON minimaux sans données sensibles, dossier **GO/NO-GO staging fail-closed** lié au SHA exact du candidat (`npm run go-no-go:staging`), preflight runtime PostgreSQL least-privilege, drill de restauration de sauvegarde, runbook final GO-LIVE/rollback (`docs/final-go-live-runbook.md`). |
| **Documentation** | ~57 documents dans `docs/`, dont `product-blueprint.md` (le blueprint d'origine : « Wave reste la source de vérité comptable officielle une fois un brouillon émis ») et une spec OpenAPI d'intégration TAKATAK (`docs/takatak-integration-v1.openapi.json`). 46 issues ouvertes au compteur GitHub (dont l'audit #27 et la protection de `main` #41, citées par le README). |

### 2.2 Ce qui n'existe PAS encore (le dépôt le dit lui-même)

- Aucune **exécution Wave réelle** ni réconciliation contre un compte Wave réel.
- Aucun **fournisseur courriel réel** (l'adapter est simulé) ; aucune preuve de remise réelle.
- Aucun **débit/remboursement réel** chez un processeur (les preuves Stripe vérifiées existent ; le rail de paiement complet reste à homologuer).
- **Aucun grand livre, aucun plan comptable, aucun journal d'écritures** : Facturations est un moteur de facturation + preuves, pas encore un système comptable complet. C'est précisément le saut 4CCOUNTING.
- Aucune gestion des **dépenses/fournisseurs**, des **comptes à payer**, de la **paie**, de la **conciliation bancaire**, des **revenus de plateformes** ni des **rapports de taxes** — les taxes sont saisies explicitement, jamais calculées ni déclarées par le système.
- Aucun **fournisseur IA/voix réel** intégré (le contrat de sécurité existe, le fournisseur reste à choisir et à passer en revue).
- Aucune revue fiscale/comptable externe, aucune homologation TLS/hébergement de production.

### 2.3 Décision d'architecture que pose 4CCOUNTING

Le blueprint d'origine de Facturations désigne **Wave comme source de vérité officielle après émission**. 4CCOUNTING fait évoluer ce positionnement en deux temps, sans jamais contredire l'existant :

- **Phase 1** : Wave reste branché tel quel (lecture + émission contrôlée quand homologuée) pendant que 4CCOUNTING ajoute dépenses, taxes et rapports **autour** du noyau.
- **Phase 2** : le **grand livre interne de 4CCOUNTING devient le livre officiel du groupe** ; Wave passe en rôle de réconciliation/export (ou est retiré entreprise par entreprise, sur décision de Matt + du comptable). La bascule se fait par écritures d'ouverture vérifiées, jamais par migration silencieuse.


---

## 3. Les modules ALL-IN-1

Chaque module précise : ce qu'il fait, ce qu'il réutilise du socle, ce qui est nouveau. Règle commune à tous les modules : **toute écriture comptable naît d'un document source** (facture, reçu, rapport, feuille de temps) et garde sa provenance ; aucune écriture « orpheline » saisie à la main sans pièce justificative ou note OWNER.

### Module 1 — Facturation clients complète
- **Réutilise** : tout le socle Facturations (brouillons révisés, chaîne OWNER, PDF qualifiés, portail client, preuves de paiement Stripe, répertoire clients).
- **À compléter** : devis → facture (conversion en un geste, le devis suit la même chaîne de brouillon/approbation) ; **factures récurrentes** (schedules autorisés séparément, comme le blueprint d'origine le prévoit) ; dépôts et acomptes ; notes de crédit et réémissions par workflow propre (jamais d'édition d'une facture émise) ; catalogue de lignes/services par entreprise.
- **Taxes** : TPS 5 % et TVQ 9,975 % appliquées selon les **règles vérifiées de l'entreprise émettrice** (profil émetteur OWNER-vérifié : numéros d'enregistrement TPS/TVQ, méthode de calcul, arrondis). Le système calcule à partir de la règle enregistrée — il n'infère jamais un taux ni un numéro (règle héritée du socle : aucune décision fiscale automatisée sans règle OWNER-vérifiée).
- **Numérotation** : contrôlée par le système (séquence par entreprise, sans trou non expliqué) ; si Wave reste émetteur pour une entreprise en Phase 1, la numérotation Wave fait foi pour cette entreprise et le registre local la reflète.

### Module 2 — Comptes à recevoir / comptes à payer (AR/AP)
- **AR** : balance âgée (courant, 30/60/90+) par client et par entreprise, calculée depuis le registre des factures et le ledger de preuves de paiement ; **relances automatiques par courriel** sur des gabarits FR/EN approuvés (J+7, J+14, J+30 — paramètres par entreprise), envoyées via le même pipeline de livraison autorisée que les factures (tentatives persistées, preuves de remise, jamais d'envoi silencieux).
- **AP** : jumeau côté fournisseurs — factures à payer saisies via le Module 3, échéancier de paiements, balance âgée fournisseurs, alertes d'échéance. Le paiement lui-même reste exécuté à la banque ; 4CCOUNTING enregistre la preuve de paiement (référence, date, montant) et la lie à la facture fournisseur.

### Module 3 — Dépenses et reçus fournisseurs (+ FOOD COST)
- **Capture** : photo de reçu/facture fournisseur (mobile), **OCR + extraction structurée par l'assistant IA** (même contrat de sécurité que le socle : champs proposés, jamais d'écriture directe ; l'humain confirme fournisseur, date, montants, taxes, catégorie).
- **Catégorisation IA** proposée (compte de dépense du plan comptable de l'entreprise), confirmée par l'utilisateur ; l'historique des confirmations entraîne les suggestions suivantes par fournisseur.
- **Lien FOOD COST** : les achats alimentaires catégorisés (viandes, produce, dry goods, breuvages…) alimentent directement le **tableau food cost** du groupe (le projet « Tableau food cost — 193 lignes » se branche ici) : coût des ingrédients par item de menu, food cost % par restaurant, écarts vs prix fournisseurs. C'est la même donnée que le Module 12 affiche.
- Taxes récupérables : la part TPS/TVQ payée sur les achats (CTI/RTI) est ventilée dès la saisie — elle alimente le Module 5.

### Module 4 — Grand livre, plan comptable multi-entreprises, écritures automatiques
- **Plan comptable par entreprise** bâti sur un **modèle groupe** (comptes standard restaurants/commerce/services) que chaque entreprise peut étendre ; mapping modèle ↔ entreprise versionné.
- **Écritures automatiques** : chaque événement des autres modules génère son écriture équilibrée (débit = crédit, en cents) : facture émise → AR + revenus + taxes à remettre ; paiement reçu → banque + AR ; dépense confirmée → dépense + taxes récupérables + AP/banque ; vente Clover du jour → revenus par catégorie + taxes + mode de paiement ; rapport DoorDash → revenus bruts, commissions, ajustements, net à recevoir.
- **Écritures manuelles** possibles pour le comptable (régularisations, amortissements) avec pièce/note obligatoire, auteur et journal d'audit — jamais de modification d'une écriture comptabilisée : on contre-passe.
- **Périodes** : fermeture mensuelle par entreprise (verrouillage), réouverture seulement par rôle OWNER/comptable avec trace.

### Module 5 — Taxes : rapports TPS/TVQ prêts à déclarer
- Pour chaque entreprise et chaque période de déclaration (mensuelle/trimestrielle/annuelle selon son inscription) : **TPS perçue, TVQ perçue, CTI (TPS payée sur achats), RTI (TVQ payée)**, ventes taxables/détaxées, ajustements — présentés en **rapport prêt à transcrire** dans la déclaration (GST/HST return fédéral + QST return Revenu Québec).
- Sommaires par entreprise et **vue groupe** (qui doit combien, pour quand) avec alertes d'échéances.
- **Limite honnête** : 4CCOUNTING **prépare** les chiffres ; la production/télédéclaration reste faite par l'entreprise ou son comptable dans les portails gouvernementaux. Aucune prétention de dépôt automatisé tant qu'une intégration officielle n'existe pas et n'est pas homologuée.
- Chaque rapport se fige en snapshot immuable (montants, période, sources) — même standard de preuve que les PDF du socle.

### Module 6 — Paie préparée (depuis ST4FF)
- **Entrée** : les feuilles de temps **ST4FF by TAKATAK** (pointages Clover, heures régulières, heures supplémentaires calculées selon les règles enregistrées de l'entreprise, pauses, congés).
- **Sortie** : un **lot de paie préparé** par période et par entreprise : heures et taux par employé, brut estimé, retenues **préparées** (paramètres transmis par le comptable), net estimé, écriture de paie au grand livre (salaires, charges, à payer).
- **Limite honnête** : préparation seulement — **aucun dépôt T4/RL-1, aucune production de feuillets, aucune remise gouvernementale** tant que ce n'est pas bâti et homologué séparément. Le lot préparé s'exporte pour le comptable ou le fournisseur de paie en place.
- Les données employés suivent le même régime que ST4FF : minimisation, accès par rôle, Loi 25.

### Module 7 — Conciliation bancaire
- **Imports** : relevés bancaires par fichiers (CSV/OFX) au départ ; connexions bancaires seulement si un fournisseur approuvé est choisi plus tard (même prudence que pour Wave/courriel : homologation d'abord).
- **Matching IA assisté** : propositions d'appariement relevé ↔ écritures/paiements/dépenses (montant, date, libellé), confirmées par l'humain ; les non-appariés restent visibles jusqu'à résolution — jamais d'appariement forcé silencieux.
- Écarts de caisse Clover vs banque traités comme des lignes de conciliation identifiées, pas absorbées dans les revenus.

### Module 8 — Revenus des plateformes (DoorDash / Uber Eats)
- **Ingestion** des rapports financiers officiels des plateformes (exports DoorDash et Uber Eats par magasin/période — le groupe télécharge déjà ces rapports ; le module les structure).
- **Ventilation comptable réelle** : ventes brutes, **commissions plateforme séparées**, frais marketing/promotions, taxes, ajustements, montant net versé — exactement comme l'argent arrive.
- **Réconciliation triple** : rapport plateforme ↔ ventes Clover/Food Hub ↔ dépôts bancaires (Module 7). Tout écart est une ligne d'exception à expliquer, pas un ajustement caché.
- Rappel : les magasins intégrés POS de DoorDash peuvent avoir leurs menus verrouillés, mais leurs **rapports financiers restent accessibles** — c'est par les rapports que ce module lit les revenus, pas par les menus.

### Module 9 — Synchronisation des ventes Clover
- **Z de fin de journée par emplacement** : ventes par catégorie/taxe/mode de paiement importées de Clover (API, OAuth marchand) et transformées en écriture quotidienne de revenus au grand livre de la bonne entreprise.
- Rapprochement avec les rapports de taxes (Module 5) : la TPS/TVQ perçue selon Clover doit égaler la TPS/TVQ déclarée par les écritures — écart = alerte.
- C'est l'intégration qui rattache 4CCOUNTING au **Clover App Market** (l'app se branche au marchand comme les autres solutions de la suite).

### Module 10 — Stripe et paiements (Rapide 2 Nette et autres)
- Réutilise la **preuve de paiement Stripe vérifiée par webhook signé** déjà construite dans le socle.
- Extension : les paiements Stripe de **Rapide 2 Nette** (réservations) et des autres activités en ligne entrent comme revenus documentés (référence de réservation ↔ paiement ↔ écriture), remboursements avec filiation stricte (déjà la règle du ledger de preuves).

### Module 11 — États financiers
- Par entreprise : **bilan, état des résultats, balance de vérification**, journal général, grand livre auxiliaire clients/fournisseurs — générés depuis le Module 4, exportables (PDF/CSV) pour le comptable et la banque.
- **Consolidé groupe** : mêmes états pour Quadro Holdings + toutes les entreprises, avec élimination des inter-entreprises identifiées (prêts/avances entre entités du groupe tracés comme tels dès la saisie).
- Comparatifs période vs période et budget vs réel (budgets simples par entreprise).

### Module 12 — Tableau de bord groupe
- Une page par entreprise + une vue groupe : **encaisse et soldes, AR/AP en souffrance, taxes à remettre (prochaine échéance), marge brute, food cost % (Module 3), labor % (ST4FF, Module 6)**, revenus par canal (salle/comptoir, Clover en ligne, DoorDash, Uber, téléphone) par emplacement.
- Alertes : échéance de taxes < 7 jours, AP en retard, écart de conciliation non résolu, food cost % au-dessus du seuil de l'entreprise.
- Le tableau de bord ne calcule rien lui-même : il lit les projections des modules — même discipline que les projections lecture seule du socle.


---

## 4. Modèle de données (esquisse)

PostgreSQL (hérité du socle), multi-tenant strict : **chaque table d'affaires porte `business_id`** et chaque accès est vérifié contre le principal authentifié — règle déjà appliquée dans Facturations. Montants en **cents entiers**, devise CAD (multi-devise seulement si un besoin réel apparaît). Les entités du socle (espaces de travail, brouillons immuables, autorisations, tentatives, registres de preuves, portail client) **restent telles quelles** ; 4CCOUNTING ajoute :

| Entité | Clés / notes |
|---|---|
| `businesses` | L'entreprise (raison sociale, NEQ, numéros TPS/TVQ, période de déclaration, exercice financier). Une ligne par entité légale du groupe ou cliente. |
| `locations` | Emplacements d'une entreprise (`business_id`, adresse, marchand Clover lié). |
| `business_memberships` | Qui (personnel/comptable) accède à quelle entreprise, avec rôle (OWNER, ACCOUNTANT, STAFF, lecture seule). |
| `issuer_profiles` *(existe)* | Profils émetteur vérifiés et versionnés du socle — portent les numéros d'enregistrement utilisés par les Modules 1 et 5. |
| `customers` / `suppliers` | Répertoire clients (existe) + miroir fournisseurs (conditions de paiement, taxes par défaut). |
| `invoices` / `invoice_lines` *(existe via registres)* | Factures émises (registre du socle) + lignes avec compte de revenu et traitement de taxe. |
| `bills` / `bill_lines` | Factures fournisseurs et dépenses, avec reçu source (`file_assets`), ventilation CTI/RTI. |
| `expense_receipts` | Captures photo + champs OCR proposés/confirmés + provenance IA (modèle, confiance, confirmation humaine). |
| `chart_of_accounts` | Comptes par entreprise (`business_id`, numéro, type, compte modèle parent, actif/archivé). |
| `journal_entries` / `journal_lines` | Écritures équilibrées, immuables une fois comptabilisées ; chaque ligne porte le compte, débit/crédit, et la **référence du document source** (type + id). Contre-passation plutôt que modification. |
| `accounting_periods` | Périodes par entreprise (ouverte/verrouillée) + fermetures. |
| `tax_period_reports` | Snapshots de rapports TPS/TVQ figés (période, montants, sources) — Module 5. |
| `bank_accounts` / `bank_statement_lines` / `reconciliations` | Comptes, lignes importées, appariements (proposé par IA / confirmé, par qui, quand). |
| `platform_reports` / `platform_report_lines` | Rapports DoorDash/Uber ingérés (magasin, période, brut, commissions, marketing, taxes, net) + statut de réconciliation. |
| `clover_daily_sales` | Z quotidiens par emplacement (catégories, taxes, modes de paiement) + écriture générée. |
| `payroll_batches` / `payroll_batch_lines` | Lots de paie préparés (source : feuilles de temps ST4FF), statut (préparé/exporté/comptabilisé), aucune donnée de dépôt gouvernemental. |
| `payments_evidence` *(existe)* | Ledger de preuves de paiement/remboursement du socle (Stripe vérifié, filiation remboursements). |
| `audit_events` *(existe)* | Journal append-only — étendu à tous les nouveaux modules. |
| `outbox_events` | File transactionnelle des effets externes (envois, syncs) — patron déjà prévu par le blueprint d'origine. |

## 5. Carte des intégrations

| Système | Sens | Mécanisme | État |
|---|---|---|---|
| **Wave** | Lecture + émission contrôlée | Connecteur du socle (lecture seule aujourd'hui ; émission par adapter injecté après homologation) | Existe (partiel, gates actifs) |
| **Clover** | Entrée (ventes, Z quotidiens) | API Clover + OAuth marchand ; app publiée au Clover App Market | À bâtir (Module 9) |
| **ST4FF by TAKATAK** | Entrée (feuilles de temps) | API interne de la suite (convention d'intégration TAKATAK v1 du socle) | À bâtir (Module 6) |
| **Food Hub (TAKATAK)** | Entrée (commandes plateformes) | API interne de la suite — complète les rapports financiers du Module 8 | À bâtir |
| **DoorDash / Uber Eats** | Entrée (rapports financiers) | Ingestion des exports officiels (fichiers) ; pas d'API promise tant qu'un accès partenaire n'est pas vérifié | À bâtir (Module 8) |
| **Stripe** | Entrée (preuves de paiement) | Webhooks signés vérifiés — **déjà construit dans le socle** ; Checkout pour factures et réservations Rapide 2 Nette | Existe (preuves) |
| **Banques** | Entrée (relevés) | Import de fichiers CSV/OFX ; appariement assisté | À bâtir (Module 7) |
| **Fournisseur courriel** | Sortie (factures, relances) | Adapter injecté (patron du socle) — **à choisir et homologuer** ; aujourd'hui simulé | Gates actifs |
| **Assistant IA/OCR** | Interne | Contrat de sécurité provider-neutral du socle ; fournisseur à choisir, revue de sécurité obligatoire | Contrat existe, fournisseur non |

## 6. Sécurité, vie privée, Loi 25

- Héritage intégral du socle : MFA TOTP du personnel, sessions révocables, cookies sécurisés, CSRF, isolation `business_id` vérifiée à chaque requête, moindre privilège PostgreSQL, sauvegardes chiffrées avec drills de restauration, journalisation sans secrets ni données brutes sensibles, dossier GO/NO-GO fail-closed avant tout passage en production.
- **Données comptables = données sensibles** : accès par rôle et par entreprise (un employé d'un restaurant ne voit pas les livres d'un autre), journal d'audit de toute consultation financière sensible, export contrôlé.
- **Loi 25 (Québec)** : responsable de la protection des renseignements personnels désigné, minimisation (on ne collecte que le nécessaire — règle déjà dans le socle pour les clients), conservation et destruction documentées, hébergement et sous-traitants (IA/OCR, courriel) déclarés avec évaluation des facteurs relatifs à la vie privée avant activation, droits d'accès/rectification des clients et employés, avis d'incident à la CAI en cas d'incident de confidentialité.
- **Rétention fiscale** : les livres et pièces justificatives se conservent selon les délais fiscaux canadiens/québécois (6 ans en règle générale) — la suppression Loi 25 ne s'applique qu'après expiration des obligations fiscales, et toujours par décision documentée.
- Aucun secret dans le dépôt public (règle du socle) ; aucune donnée client réelle dans les environnements de test.

## 7. Feuille de route de construction

### Phase 1 — Le noyau devient utilisable (Facturations durci + dépenses + taxes)
1. Fermer les gates de production de Facturations pour **une première entreprise pilote du groupe** : hébergement/base dédiés, homologation du profil émetteur, choix + homologation du fournisseur courriel réel, première exécution Wave supervisée (ou émission interne si Matt + comptable décident de devancer le GL — sinon Wave reste le rail d'émission), revue fiscale/comptable externe.
2. Module 3 (dépenses + OCR + lien food cost) et Module 2 AR (relances) sur le même pipeline de preuves.
3. Module 5 (rapports TPS/TVQ préparés) alimenté par les Modules 1 + 3.
4. Socle multi-entreprises complété : memberships par entreprise, tableau de bord de base (Module 12, vue entreprise).
**Sortie de phase :** le groupe facture, suit ses dépenses et prépare ses taxes dans 4CCOUNTING pour l'entreprise pilote, avec preuves complètes.

### Phase 2 — Le livre officiel (GL + banque + plateformes)
1. Module 4 (plan comptable modèle groupe, écritures automatiques depuis les Modules 1/2/3, périodes et fermetures) ; écritures d'ouverture par entreprise ; **bascule du livre officiel de Wave vers 4CCOUNTING** entreprise par entreprise (§2.3).
2. Module 7 (conciliation bancaire par fichiers + matching assisté).
3. Module 9 (Z Clover quotidiens) + Module 8 (rapports DoorDash/Uber réconciliés) → les revenus deviennent complets et prouvés.
4. Module 11 (états financiers par entreprise) ; publication de l'app **4CCOUNTING au Clover App Market (50 $/mois)**.
**Sortie de phase :** les états financiers du pilote sortent du système ; l'offre marchande existe.

### Phase 3 — Paie préparée + groupe consolidé
1. Module 6 (lots de paie préparés depuis les feuilles de temps ST4FF, écritures de paie, exports comptable).
2. Module 11 consolidé (éliminations inter-entreprises) + Module 12 complet (vue groupe, alertes, labor % et food cost % en continu).
3. Déploiement à toutes les entreprises du groupe, entreprise par entreprise, avec écritures d'ouverture vérifiées à chaque bascule.
4. Chantiers séparés et homologués seulement s'ils deviennent requis : télédéclaration des taxes, fournisseur de paie complet (T4/RL-1), connexions bancaires directes.
**Sortie de phase :** tout le groupe — restaurants, Rapide 2 Nette, TAKATAK Marketing — vit dans 4CCOUNTING.

---

**Rappel de prix : 50 $/mois par entreprise** — le standard de la suite TAKATAK sur le Clover App Market (Fidélité Reward, ST4FF, Food Hub, Phone AI, 4CCOUNTING…). Pour le groupe lui-même, 4CCOUNTING est l'outil interne ; le même produit se vend aux marchands Clover au même prix de suite.

*Document maître généré le 2026-10-26 sur ordre de Matt. Socle lu : github.com/takatakca/Facturations (README, package.json, arbres src/db/docs, product-blueprint) — voir le §2 pour la frontière exact entre ce qui existe et ce qui est à bâtir.*
