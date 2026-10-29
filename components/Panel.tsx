import { tierAtLeast } from '@/lib/app';
import { money, pick } from '@/lib/core/i18n';
import type { PageCtx } from '@/lib/core/page';
import { isDate, localDate } from '@/lib/core/time';
import { platformTotals, rangeBooks, type DayBook } from '@/lib/domain/books';
import { Icon } from './icons';
import { Banner, Bars, Card, Empty, Stat } from './ui';

// 4CCOUNTING screens (lib/domain `sections`): overview, sales journal, GST/QST by month, platforms, exports.
// Every screen needs books.view (manager by default); the period comes from the address (?from=&to= or ?month=).
const DAY = 86400_000;
type Sum = 'netSalesCents' | 'gstCents' | 'qstCents' | 'tipCents' | 'refundsCents' | 'grossCents' | 'payments';
const sum = (days: DayBook[], k: Sum) => days.reduce((s, d) => s + d[k], 0);

function period(query: Record<string, string> | undefined, days = 7): { from: string; to: string } {
  const to = isDate(query?.to ?? '') ? query!.to : localDate();
  const from = isDate(query?.from ?? '') ? query!.from : localDate(Date.parse(`${to}T12:00:00Z`) - (days - 1) * DAY);
  return from <= to ? { from, to } : { from: to, to: from };
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export async function Panel({ ctx, section, query }: { ctx: PageCtx; section: string; query?: Record<string, string> }) {
  switch (section) {
    case '': return <Overview ctx={ctx} />;
    case 'days': return <Journal ctx={ctx} query={query} />;
    case 'taxes': return <Taxes ctx={ctx} query={query} />;
    case 'platforms': return <Platforms ctx={ctx} query={query} />;
    case 'export': return <Export ctx={ctx} query={query} />;
    default: return null;
  }
}

const maxDays = (ctx: PageCtx) => (tierAtLeast(ctx.tier, 'vip') ? 400 : 31);

function PeriodForm({ lang, from, to, action }: { lang: 'fr' | 'en'; from: string; to: string; action: string }) {
  return (
    <form method="get" action={action} className="row">
      <div className="field"><label htmlFor="from">{pick(lang, 'Du', 'From')}</label><input id="from" name="from" type="date" defaultValue={from} /></div>
      <div className="field"><label htmlFor="to">{pick(lang, 'Au', 'To')}</label><input id="to" name="to" type="date" defaultValue={to} /></div>
      <button type="submit" className="ghost">{pick(lang, 'Afficher', 'Show')}</button>
    </form>
  );
}

async function Overview({ ctx }: { ctx: PageCtx }) {
  const { lang, merchantId } = ctx;
  const { from, to } = period(undefined, 7);
  const r = await rangeBooks(merchantId!, from, to, 31);
  if (!r.ok) return <Banner tone="warn">{r.error}</Banner>;
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <>
      <div className="grid">
        <Stat label={pick(lang, 'Ventes nettes (7 j)', 'Net sales (7 d)')} value={money(sum(r.days, 'netSalesCents'), lang)} note={`${sum(r.days, 'payments')} ${pick(lang, 'paiements', 'payments')}`} />
        <Stat label="TPS / GST" value={money(sum(r.days, 'gstCents'), lang)} />
        <Stat label="TVQ / QST" value={money(sum(r.days, 'qstCents'), lang)} />
        <Stat label={pick(lang, 'Pourboires', 'Tips')} value={money(sum(r.days, 'tipCents'), lang)} />
        <Stat label={pick(lang, 'Remboursements', 'Refunds')} value={money(sum(r.days, 'refundsCents'), lang)} tone={sum(r.days, 'refundsCents') ? 'warn' : undefined} />
      </div>
      <Card title={pick(lang, 'Ventes nettes par jour', 'Net sales per day')} icon="chart" sub={`${from} → ${to}`}
        right={ctx.can('books.export') ? <a className="btn ghost" href={`/api/reports/csv?from=${from}&to=${to}`}><Icon name="download" size={16} /> CSV</a> : undefined}>
        <Bars rows={r.days.map((d) => ({ label: day(d.date), value: d.netSalesCents, shown: money(d.netSalesCents, lang), note: `${d.payments} ${pick(lang, 'paiements', 'payments')}` }))} empty={pick(lang, 'Aucune vente sur la période.', 'No sale in the period.')} />
      </Card>
      {r.days.some((d) => d.estimatedTax) && <p className="muted small">{pick(lang, '* Certains paiements n’indiquent pas leurs taux : taxes réparties 5 : 9,975 (estimé).', '* Some payments do not list their rates: taxes split 5 : 9.975 (estimated).')}</p>}
    </>
  );
}

async function Journal({ ctx, query }: { ctx: PageCtx; query?: Record<string, string> }) {
  const { lang, merchantId } = ctx;
  const { from, to } = period(query, 7);
  const r = await rangeBooks(merchantId!, from, to, maxDays(ctx));
  const tenders = r.ok ? [...new Set(r.days.flatMap((d) => Object.keys(d.byTender)))] : [];
  return (
    <>
      <Card title={pick(lang, 'Période', 'Period')} icon="calendar" sub={pick(lang, `Jusqu’à ${maxDays(ctx)} jours par rapport.`, `Up to ${maxDays(ctx)} days per report.`)}
        right={r.ok && ctx.can('books.export') ? <a className="btn ghost" href={`/api/reports/csv?from=${from}&to=${to}`}><Icon name="download" size={16} /> CSV</a> : undefined}>
        <PeriodForm lang={lang} from={from} to={to} action="/app/days" />
      </Card>
      {!r.ok ? <Banner tone="warn">{r.error}</Banner> : (
        <Card title={`${from} → ${to}`} icon="list">
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th className="right">#</th><th className="right">{pick(lang, 'Brut', 'Gross')}</th><th className="right">{pick(lang, 'Nettes', 'Net')}</th><th className="right">TPS</th><th className="right">TVQ</th><th className="right">{pick(lang, 'Pourb.', 'Tips')}</th><th className="right">{pick(lang, 'Remb.', 'Refunds')}</th>{tenders.map((t) => <th key={t} className="right">{t}</th>)}</tr></thead>
            <tbody>{r.days.map((d) => <tr key={d.date}><td className="nowrap">{d.date}{d.estimatedTax ? ' *' : ''}</td><td className="right">{d.payments}</td><td className="right">{money(d.grossCents, lang)}</td><td className="right">{money(d.netSalesCents, lang)}</td><td className="right">{money(d.gstCents, lang)}</td><td className="right">{money(d.qstCents, lang)}</td><td className="right">{money(d.tipCents, lang)}</td><td className="right">{money(d.refundsCents, lang)}</td>{tenders.map((t) => <td key={t} className="right">{money(d.byTender[t] ?? 0, lang)}</td>)}</tr>)}</tbody>
            <tfoot><tr><th>Total</th><th className="right">{sum(r.days, 'payments')}</th><th className="right">{money(sum(r.days, 'grossCents'), lang)}</th><th className="right">{money(sum(r.days, 'netSalesCents'), lang)}</th><th className="right">{money(sum(r.days, 'gstCents'), lang)}</th><th className="right">{money(sum(r.days, 'qstCents'), lang)}</th><th className="right">{money(sum(r.days, 'tipCents'), lang)}</th><th className="right">{money(sum(r.days, 'refundsCents'), lang)}</th>{tenders.map((t) => <th key={t} className="right">{money(r.days.reduce((s, d) => s + (d.byTender[t] ?? 0), 0), lang)}</th>)}</tr></tfoot>
          </table></div>
          {r.days.some((d) => d.estimatedTax) && <p className="muted small">{pick(lang, '* Taxes réparties 5 : 9,975 (le paiement n’indique pas ses taux).', '* Taxes split 5 : 9.975 (the payment does not list its rates).')}</p>}
        </Card>
      )}
    </>
  );
}

async function Taxes({ ctx, query }: { ctx: PageCtx; query?: Record<string, string> }) {
  const { lang, merchantId } = ctx;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query?.month ?? '') ? query!.month : localDate().slice(0, 7);
  const { from, to } = monthRange(month);
  const r = await rangeBooks(merchantId!, from, to, 31);
  const monthName = new Date(`${from}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { month: 'long', year: 'numeric' });
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); });
  return (
    <>
      <Card title={pick(lang, 'Mois', 'Month')} icon="calendar">
        <form method="get" action="/app/taxes" className="row">
          <div className="field"><label htmlFor="month">{pick(lang, 'Mois', 'Month')}</label><select id="month" name="month" defaultValue={month}>{months.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          <button type="submit" className="ghost">{pick(lang, 'Afficher', 'Show')}</button>
        </form>
      </Card>
      {!r.ok ? <Banner tone="warn">{r.error}</Banner> : (
        <>
          <div className="grid">
            <Stat label={`TPS / GST · ${monthName}`} value={money(sum(r.days, 'gstCents'), lang)} note={pick(lang, '5 % — Agence du revenu du Canada', '5% — Canada Revenue Agency')} />
            <Stat label={`TVQ / QST · ${monthName}`} value={money(sum(r.days, 'qstCents'), lang)} note={pick(lang, '9,975 % — Revenu Québec', '9.975% — Revenu Québec')} />
            <Stat label={pick(lang, 'Ventes taxables nettes', 'Net taxable sales')} value={money(sum(r.days, 'netSalesCents'), lang)} />
          </div>
          <Card title={pick(lang, 'Par jour', 'Per day')} icon="tax">
            <Bars rows={r.days.filter((d) => d.gstCents + d.qstCents > 0).map((d) => ({ label: d.date, value: d.gstCents + d.qstCents, shown: money(d.gstCents + d.qstCents, lang), note: `TPS ${money(d.gstCents, lang)} · TVQ ${money(d.qstCents, lang)}` }))} empty={pick(lang, 'Aucune taxe perçue ce mois-ci.', 'No tax collected this month.')} />
          </Card>
          <p className="muted small">{pick(lang, 'Ce sont les taxes perçues selon Clover. Les remises (et les crédits de taxe sur intrants) restent le travail de votre comptable. Les reçus Revenu Québec (MEV) sont produits par TAKATAK MEV.', 'These are the taxes collected per Clover. Remittances (and input tax credits) stay your accountant’s job. Revenu Québec receipts (MEV) are produced by TAKATAK MEV.')}</p>
        </>
      )}
    </>
  );
}

async function Platforms({ ctx, query }: { ctx: PageCtx; query?: Record<string, string> }) {
  const { lang, merchantId } = ctx;
  const { from, to } = period(query, 30);
  const list = await platformTotals(merchantId!, from, to);
  const NAMES: Record<string, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash', skip: 'Skip', too_good_to_go: 'Too Good To Go' };
  return (
    <>
      <Card title={pick(lang, 'Période', 'Period')} icon="calendar"><PeriodForm lang={lang} from={from} to={to} action="/app/platforms" /></Card>
      <Card title={pick(lang, 'Ventes des plateformes (Food Hub)', 'Platform sales (Food Hub)')} icon="truck" sub={pick(lang, 'Les plateformes encaissent et versent ces ventes : elles ne sont pas des paiements Clover.', 'The platforms collect and pay out these sales: they are not Clover payments.')}>
        {list.length === 0 ? <Empty icon="truck">{pick(lang, 'Aucune — branchez la suite TAKATAK (Food Hub) pour voir Uber Eats, DoorDash, Skip…', 'None — connect the TAKATAK Suite (Food Hub) to see Uber Eats, DoorDash, Skip…')}</Empty>
          : <Bars rows={list.map((p) => ({ label: NAMES[p.channel] ?? p.channel, value: p.totalCents, shown: money(p.totalCents, lang), note: `${p.orders} ${pick(lang, 'commandes', 'orders')}` }))} />}
      </Card>
    </>
  );
}

function Export({ ctx, query }: { ctx: PageCtx; query?: Record<string, string> }) {
  const { lang } = ctx;
  const { from, to } = period(query, 7);
  return (
    <Card title={pick(lang, 'Exporter une période', 'Export a period')} icon="download" sub={pick(lang, 'Une ligne par jour, taxes séparées, une colonne par mode de paiement.', 'One line per day, taxes split, one column per tender.')}>
      <form action="/api/reports/csv" method="get" className="row">
        <div className="field"><label htmlFor="from">{pick(lang, 'Du', 'From')}</label><input id="from" name="from" type="date" defaultValue={from} /></div>
        <div className="field"><label htmlFor="to">{pick(lang, 'Au', 'To')}</label><input id="to" name="to" type="date" defaultValue={to} /></div>
        <button type="submit"><Icon name="download" size={16} /> CSV</button>
      </form>
      <p className="muted small">{tierAtLeast(ctx.tier, 'vip') ? pick(lang, 'Jusqu’à 400 jours par export (VIP).', 'Up to 400 days per export (VIP).') : pick(lang, 'Jusqu’à 31 jours par export (400 jours : VIP).', 'Up to 31 days per export (400 days: VIP).')}</p>
      <p className="muted small">{pick(lang, 'Les reçus Revenu Québec (MEV) sont produits par TAKATAK MEV, pas par cette app.', 'Revenu Québec receipts (MEV) are produced by TAKATAK MEV, not by this app.')}</p>
    </Card>
  );
}
