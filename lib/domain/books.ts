// 4CCOUNTING — the merchant's books from Clover payments, Québec taxes split.
//  - Each day (Montréal time): payments, gross, GST (TPS 5 %), QST (TVQ 9.975 %), other taxes, tips, refunds,
//    net sales, by tender. A payment's tax is split by its own tax rates (Clover PaymentTaxRate list) in proportion of
//    their rates; a payment without that list is split 5 : 9.975 and marked "estimated".
//  - Platform sales (Uber Eats, DoorDash, Skip…) arrive from Food Hub (TAKATAK Suite) and are shown apart: the
//    platforms collect and pay them, they are not Clover payments.
//  - CSV for the accountant. Base: up to 31 days per report; VIP: any range.
//  - Not a sales-recording system (SRS/MEV): Revenu Québec receipts are TAKATAK MEV's job (QCMEV.CA).
import { cloverGetAll, mpath } from '../clover/api';
import { getStore } from '../core/store';
import { localDate, localDayRange } from '../core/time';

export interface DayBook {
  date: string; payments: number; grossCents: number; netSalesCents: number; gstCents: number; qstCents: number; otherTaxCents: number; tipCents: number; refundsCents: number;
  estimatedTax: boolean; byTender: Record<string, number>;
}

const isGst = (name: string) => /\b(tps|gst|hst)\b/i.test(name) || /f[ée]d[ée]ral/i.test(name);
const isQst = (name: string) => /\b(tvq|qst)\b/i.test(name) || /qu[ée]bec/i.test(name);

/** Split one payment's tax between GST, QST and other, by the payment's own tax rates. */
export function splitTax(taxCents: number, rates: Array<{ name?: string; rate?: number }> | null | undefined): { gst: number; qst: number; other: number; estimated: boolean } {
  const list = (rates ?? []).filter((r) => Number(r.rate) > 0);
  if (!taxCents) return { gst: 0, qst: 0, other: 0, estimated: false };
  if (!list.length) { const gst = Math.round((taxCents * 5) / 14.975); return { gst, qst: taxCents - gst, other: 0, estimated: true }; }
  const total = list.reduce((s, r) => s + Number(r.rate), 0);
  let gst = 0; let qst = 0; let other = 0;
  for (const r of list) {
    const part = Math.round((taxCents * Number(r.rate)) / total);
    const name = String(r.name ?? '');
    if (isGst(name)) gst += part; else if (isQst(name)) qst += part; else other += part;
  }
  const diff = taxCents - gst - qst - other; // rounding stays in the largest bucket
  if (qst >= gst && qst >= other) qst += diff; else if (gst >= other) gst += diff; else other += diff;
  return { gst, qst, other, estimated: false };
}

export function bookDay(date: string, payments: any[], start = -Infinity, end = Infinity): DayBook {
  const b: DayBook = { date, payments: 0, grossCents: 0, netSalesCents: 0, gstCents: 0, qstCents: 0, otherTaxCents: 0, tipCents: 0, refundsCents: 0, estimatedTax: false, byTender: {} };
  let tax = 0;
  for (const p of payments) {
    if (p.result && p.result !== 'SUCCESS') continue;
    const amount = Number(p.amount) || 0; const t = Number(p.taxAmount) || 0; const tip = Number(p.tipAmount) || 0;
    b.payments++; b.grossCents += amount; b.tipCents += tip; tax += t;
    const s = splitTax(t, p.taxRates?.elements ?? p.taxRates);
    b.gstCents += s.gst; b.qstCents += s.qst; b.otherTaxCents += s.other; b.estimatedTax ||= s.estimated;
    const label = String(p.tender?.label ?? 'Autre');
    b.byTender[label] = (b.byTender[label] ?? 0) + amount;
    b.refundsCents += ((p.refunds?.elements ?? []) as any[]).filter((r) => { const at = Number(r.createdTime); return !Number.isFinite(at) || (at >= start && at < end); }).reduce((x, r) => x + (Number(r.amount) || 0), 0);
  }
  b.netSalesCents = b.grossCents - tax - b.refundsCents;
  return b;
}

export async function dayBook(mid: string, date: string): Promise<{ ok: true; book: DayBook } | { ok: false; error: string }> {
  const [start, end] = localDayRange(date);
  const r = await cloverGetAll<any>(mid, mpath(mid, '/payments'), { filter: [`createdTime>=${start}`, `createdTime<${end}`], expand: 'tender,refunds,taxRates' });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not read Clover payments.' };
  return { ok: true, book: bookDay(date, r.items, start, end) };
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`) && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export async function rangeBooks(mid: string, from: string, to: string, maxDays: number): Promise<{ ok: true; days: DayBook[] } | { ok: false; error: string }> {
  const dates = datesBetween(from, to);
  if (!dates.length) return { ok: false, error: '"from" must be on or before "to".' };
  if (dates.length > maxDays) return { ok: false, error: `At most ${maxDays} days per report on this plan.` };
  if (to > localDate()) return { ok: false, error: 'The report cannot go past today.' };
  const days: DayBook[] = [];
  for (const d of dates) {
    const r = await dayBook(mid, d);
    if (!r.ok) return r;
    days.push(r.book);
  }
  return { ok: true, days };
}

const cad = (c: number) => (c / 100).toFixed(2);
export function booksCsv(days: DayBook[]): string {
  const tenders = [...new Set(days.flatMap((d) => Object.keys(d.byTender)))].sort();
  const head = ['date', 'payments', 'gross', 'net_sales', 'gst_tps', 'qst_tvq', 'other_tax', 'tips', 'refunds', 'tax_estimated', ...tenders.map((t) => `tender:${t}`)];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = days.map((d) => [d.date, String(d.payments), cad(d.grossCents), cad(d.netSalesCents), cad(d.gstCents), cad(d.qstCents), cad(d.otherTaxCents), cad(d.tipCents), cad(d.refundsCents), d.estimatedTax ? 'yes' : 'no', ...tenders.map((t) => cad(d.byTender[t] ?? 0))]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

// ---- platform sales from Food Hub ----
export const PLATFORM = 'platform_orders';
export interface PlatformOrder { orderId: string; channel: string; status: string; totalCents: number; taxCents: number; tipCents: number; placedAt: string }

export async function recordPlatformOrder(order: any): Promise<boolean> {
  const mid = order?.cloverMerchantId;
  if (!mid || !order?.orderId) return false;
  const rec: PlatformOrder = {
    orderId: String(order.orderId), channel: String(order.channel ?? 'other'), status: String(order.status ?? ''), placedAt: String(order.placedAt ?? new Date().toISOString()),
    totalCents: Math.round((Number(order.total) || 0) * 100), taxCents: Math.round((Number(order.tax) || 0) * 100), tipCents: Math.round((Number(order.tip) || 0) * 100),
  };
  await getStore().put(PLATFORM, `${mid}:${rec.orderId}`, String(mid), rec, rec.placedAt);
  return true;
}

export async function platformTotals(mid: string, from: string, to: string): Promise<Array<{ channel: string; orders: number; totalCents: number }>> {
  const since = new Date(localDayRange(from)[0]).toISOString();
  const until = new Date(localDayRange(to)[1]).toISOString();
  const list = (await getStore().list<PlatformOrder>(PLATFORM, { merchantId: mid, since, until, limit: 50_000 })).map((d) => d.data).filter((o) => o.status !== 'cancelled' && o.status !== 'failed');
  const by = new Map<string, { channel: string; orders: number; totalCents: number }>();
  for (const o of list) { const x = by.get(o.channel) ?? { channel: o.channel, orders: 0, totalCents: 0 }; x.orders++; x.totalCents += o.totalCents; by.set(o.channel, x); }
  return [...by.values()].sort((a, b) => b.totalCents - a.totalCents);
}
