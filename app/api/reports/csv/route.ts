import { tierAtLeast } from '@/lib/app';
import { isCtx, requireMerchant } from '@/lib/core/guard';
import { fail } from '@/lib/core/http';
import { isDate, localDate } from '@/lib/core/time';
import { booksCsv, rangeBooks } from '@/lib/domain/books';

export const dynamic = 'force-dynamic';

// GET ?from&to → CSV file for the accountant (one line per day, taxes split, tenders as columns). books.export, logged.
export async function GET(req: Request) {
  const c = await requireMerchant(req, 'base', { action: 'books.export', audit: 'always' });
  if (!isCtx(c)) return c;
  const q = new URL(req.url).searchParams;
  const from = q.get('from') ?? localDate(); const to = q.get('to') ?? from;
  if (!isDate(from) || !isDate(to)) return fail('from / to must be YYYY-MM-DD');
  const r = await rangeBooks(c.merchantId, from, to, tierAtLeast(c.tier, 'vip') ? 400 : 31);
  if (!r.ok) return fail(r.error);
  return new Response(booksCsv(r.days), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="4ccounting-${from}_${to}.csv"`, 'cache-control': 'no-store' } });
}
