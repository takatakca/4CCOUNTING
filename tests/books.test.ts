// 4CCOUNTING: GST/QST split, day books, CSV, platform sales from Food Hub.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookDay, booksCsv, dayBook, platformTotals, rangeBooks, splitTax } from '@/lib/domain/books';
import { hooks } from '@/lib/domain';
import { connect, fakeClover, MID } from './helpers';

let payments: any[] = [];
let calls: ReturnType<typeof fakeClover>;
beforeEach(async () => {
  payments = [];
  calls = fakeClover([(u) => (u.pathname.endsWith('/payments') ? { elements: payments } : undefined)]);
  await connect();
});
afterEach(() => vi.unstubAllGlobals());

describe('taxes', () => {
  it('splits by the payment’s own rates, or 5 : 9.975 when it has none', () => {
    expect(splitTax(1498, [{ name: 'TPS', rate: 500000 }, { name: 'TVQ', rate: 997500 }])).toEqual({ gst: 500, qst: 998, other: 0, estimated: false });
    expect(splitTax(500, [{ name: 'GST', rate: 500000 }])).toEqual({ gst: 500, qst: 0, other: 0, estimated: false });
    expect(splitTax(1498, null)).toEqual({ gst: 500, qst: 998, other: 0, estimated: true });
    expect(splitTax(0, null)).toEqual({ gst: 0, qst: 0, other: 0, estimated: false });
  });
});

describe('books', () => {
  it('a day: gross, net, taxes, tips, refunds, tenders; failed payments ignored', () => {
    const b = bookDay('2026-10-28', [
      { result: 'SUCCESS', amount: 11498, taxAmount: 1498, tipAmount: 200, tender: { label: 'Visa' }, taxRates: { elements: [{ name: 'TPS', rate: 500000 }, { name: 'TVQ', rate: 997500 }] } },
      { result: 'SUCCESS', amount: 1150, taxAmount: 150, tender: { label: 'Comptant' }, refunds: { elements: [{ amount: 1150, createdTime: 5 }] } },
      { result: 'FAIL', amount: 999 },
    ], 0, 10);
    expect(b).toMatchObject({ payments: 2, grossCents: 12648, gstCents: 500 + 50, qstCents: 998 + 100, tipCents: 200, refundsCents: 1150, netSalesCents: 12648 - 1648 - 1150, estimatedTax: true, byTender: { Visa: 11498, Comptant: 1150 } });
  });

  it('reads Clover payments for a Montréal day with taxRates; CSV has one line per day', async () => {
    payments = [{ result: 'SUCCESS', amount: 1150, taxAmount: 150, tender: { label: 'Visa' } }];
    const d = await dayBook(MID, '2026-10-27');
    expect(d.ok).toBe(true);
    expect(calls.find((c) => c.path.endsWith('/payments'))!.search).toContain('expand=tender%2Crefunds%2CtaxRates');
    const r = await rangeBooks(MID, '2026-10-26', '2026-10-27', 31);
    if (!r.ok) throw new Error(r.error);
    const csv = booksCsv(r.days);
    expect(csv.split('\n')[0]).toContain('gst_tps,qst_tvq');
    expect(csv.trim().split('\n')).toHaveLength(3);
    expect(await rangeBooks(MID, '2026-09-01', '2026-10-27', 31)).toMatchObject({ ok: false });
    expect(await rangeBooks(MID, '2026-10-27', '2026-10-26', 31)).toMatchObject({ ok: false });
  });

  it('keeps Food Hub platform orders by channel, cancelled ones left out', async () => {
    const ev = (id: string, status: string, channel = 'uber_eats') => ({ id, type: 'order.status_changed', createdAt: '', source: 'foodhub', data: { order: { orderId: id, cloverMerchantId: MID, channel, status, total: 25, tax: 3, tip: 2, placedAt: '2026-10-27T18:00:00.000Z' } } });
    await hooks.onSuiteEvent!(ev('o1', 'completed'));
    await hooks.onSuiteEvent!(ev('o2', 'cancelled'));
    await hooks.onSuiteEvent!(ev('o3', 'completed', 'doordash'));
    expect(await platformTotals(MID, '2026-10-27', '2026-10-27')).toEqual([{ channel: 'uber_eats', orders: 1, totalCents: 2500 }, { channel: 'doordash', orders: 1, totalCents: 2500 }]);
  });
});
