// 4CCOUNTING's side of the shared shell: hooks, menu sections, authorized actions, device kinds, what each plan adds.
// Food Hub's platform orders are kept for the "platform sales" section (Clover payments are read live).
import type { AppHooks } from '../hooks';
import type { AppAction, AppSection, DeviceKind, TierFeatures } from '../nav';
import { recordPlatformOrder } from './books';

export const hooks: AppHooks = {
  async onSuiteEvent(e) {
    if (e.type === 'order.created' || e.type === 'order.status_changed') await recordPlatformOrder(e.data?.order);
  },
};

export const sections: AppSection[] = [
  { slug: '', fr: 'Vue d’ensemble', en: 'Overview', icon: 'chart', view: 'books.view', hintFr: 'Vos 7 derniers jours : ventes nettes, TPS, TVQ, pourboires.', hintEn: 'Your last 7 days: net sales, GST, QST, tips.' },
  { slug: 'books', fr: 'Livres', en: 'Books', icon: 'book', hub: true, view: 'books.view', hintFr: 'Journal des ventes, taxes, plateformes et exports.', hintEn: 'Sales journal, taxes, platforms and exports.' },
  { slug: 'days', parent: 'books', fr: 'Journal des ventes', en: 'Sales journal', icon: 'list', view: 'books.view', hintFr: 'Une ligne par jour, pour la période de votre choix.', hintEn: 'One line per day, for the period you choose.' },
  { slug: 'taxes', parent: 'books', fr: 'TPS et TVQ', en: 'GST and QST', icon: 'tax', view: 'books.view', hintFr: 'Taxes perçues par mois, prêtes pour vos remises.', hintEn: 'Taxes collected per month, ready for your remittances.' },
  { slug: 'platforms', parent: 'books', fr: 'Plateformes', en: 'Platforms', icon: 'truck', view: 'books.view', hintFr: 'Uber Eats, DoorDash, Skip… reçus de Food Hub, à part de Clover.', hintEn: 'Uber Eats, DoorDash, Skip… from Food Hub, apart from Clover.' },
  { slug: 'export', parent: 'books', fr: 'Exports', en: 'Exports', icon: 'download', view: 'books.export', hintFr: 'Fichier CSV pour votre comptable.', hintEn: 'CSV file for your accountant.' },
];

export const actions: AppAction[] = [
  { key: 'books.view', fr: 'Voir les livres (ventes, taxes, pourboires)', en: 'See the books (sales, taxes, tips)', min: 'manager' },
  { key: 'books.export', fr: 'Exporter les livres en CSV', en: 'Export the books as CSV', min: 'manager' },
];

export const deviceKinds: DeviceKind[] = [];

export const tierFeatures: TierFeatures = {
  base: [
    ['Livres du jour depuis les paiements Clover', 'Daily books from Clover payments'],
    ['TPS et TVQ séparées, pourboires, remboursements, modes de paiement', 'GST and QST split, tips, refunds, tenders'],
    ['Export CSV jusqu’à 31 jours', 'CSV export up to 31 days'],
    ['Ventes des plateformes à part, avec Food Hub', 'Platform sales apart, with Food Hub'],
  ],
  premium: [
    ['Bientôt : rapprochement versements et ventes, passif REW4RDS, coûts ST4FF', 'Coming: payouts vs sales, REW4RDS liability, ST4FF costs'],
  ],
  vip: [
    ['Historique sur toute période (jusqu’à 400 jours par rapport)', 'History over any period (up to 400 days per report)'],
    ['Bientôt : écritures prêtes à importer, alertes d’anomalies', 'Coming: ready-to-import entries, anomaly alerts'],
  ],
};
