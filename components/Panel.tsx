import { tierAtLeast } from '@/lib/app';
import { money, pick } from '@/lib/core/i18n';
import type { PageCtx } from '@/lib/core/page';
import { localDate } from '@/lib/core/time';
import { platformTotals, rangeBooks } from '@/lib/domain/books';
import { Banner, Card, Stat } from './ui';

// 4CCOUNTING dashboard: the last 7 days from Clover, GST/QST split, platform sales from Food Hub, CSV export.
export async function Panel({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId, tier } = ctx;
  if (!merchantId) return null;
  const to = localDate();
  const from = localDate(Date.now() - 6 * 86400_000);
  const [r, platforms] = await Promise.all([rangeBooks(merchantId, from, to, 31), platformTotals(merchantId, from, to)]);
  if (!r.ok) return <Banner tone="warn">{r.error}</Banner>;
  const sum = (k: 'netSalesCents' | 'gstCents' | 'qstCents' | 'tipCents' | 'refundsCents') => r.days.reduce((s, d) => s + d[k], 0);
  return (
    <>
      <Card title={pick(lang, `7 derniers jours (${from} → ${to})`, `Last 7 days (${from} → ${to})`)} right={<a className="btn ghost" href={`/api/reports/csv?from=${from}&to=${to}`}>CSV</a>}>
        <div className="grid">
          <Stat label={pick(lang, 'Ventes nettes', 'Net sales')} value={money(sum('netSalesCents'), lang)} />
          <Stat label="TPS / GST" value={money(sum('gstCents'), lang)} />
          <Stat label="TVQ / QST" value={money(sum('qstCents'), lang)} />
          <Stat label={pick(lang, 'Pourboires', 'Tips')} value={money(sum('tipCents'), lang)} />
          <Stat label={pick(lang, 'Remboursements', 'Refunds')} value={money(sum('refundsCents'), lang)} />
        </div>
        {r.days.some((d) => d.estimatedTax) && <p className="muted">{pick(lang, '* Certains paiements n’indiquent pas leurs taux : taxes réparties 5 : 9,975 (estimé).', '* Some payments do not list their rates: taxes split 5 : 9.975 (estimated).')}</p>}
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>Date</th><th>#</th><th>{pick(lang, 'Nettes', 'Net')}</th><th>TPS</th><th>TVQ</th><th>{pick(lang, 'Pourb.', 'Tips')}</th></tr></thead>
          <tbody>{r.days.map((d) => <tr key={d.date}><td>{d.date}{d.estimatedTax ? ' *' : ''}</td><td>{d.payments}</td><td>{money(d.netSalesCents, lang)}</td><td>{money(d.gstCents, lang)}</td><td>{money(d.qstCents, lang)}</td><td>{money(d.tipCents, lang)}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title={pick(lang, 'Ventes des plateformes (Food Hub)', 'Platform sales (Food Hub)')}>
        {platforms.length === 0
          ? <p className="muted">{pick(lang, 'Aucune — branchez la suite TAKATAK (Food Hub) pour voir Uber Eats, DoorDash, Skip…', 'None — connect the TAKATAK Suite (Food Hub) to see Uber Eats, DoorDash, Skip…')}</p>
          : <table><thead><tr><th>{pick(lang, 'Plateforme', 'Platform')}</th><th>{pick(lang, 'Commandes', 'Orders')}</th><th>Total</th></tr></thead><tbody>{platforms.map((p) => <tr key={p.channel}><td>{p.channel}</td><td>{p.orders}</td><td>{money(p.totalCents, lang)}</td></tr>)}</tbody></table>}
      </Card>
      <Card title={pick(lang, 'Exporter une période', 'Export a period')}>
        <form action="/api/reports/csv" method="get" className="row">
          <div><label htmlFor="from">{pick(lang, 'Du', 'From')}</label><input id="from" name="from" type="date" defaultValue={from} /></div>
          <div><label htmlFor="to">{pick(lang, 'Au', 'To')}</label><input id="to" name="to" type="date" defaultValue={to} /></div>
          <button type="submit">CSV</button>
        </form>
        <p className="muted">{tierAtLeast(tier, 'vip') ? pick(lang, 'Historique illimité (VIP).', 'Unlimited history (VIP).') : pick(lang, 'Jusqu’à 31 jours par export (historique illimité : VIP).', 'Up to 31 days per export (unlimited history: VIP).')}</p>
        <p className="muted">{pick(lang, 'Les reçus Revenu Québec (MEV) sont produits par TAKATAK MEV, pas par cette app.', 'Revenu Québec receipts (MEV) are produced by TAKATAK MEV, not by this app.')}</p>
      </Card>
    </>
  );
}
