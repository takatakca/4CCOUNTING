import { tierAtLeast } from '@/lib/app';
import { isCtx, requireMerchant } from '@/lib/core/guard';
import { fail, ok } from '@/lib/core/http';
import { isDate, localDate } from '@/lib/core/time';
import { platformTotals, rangeBooks } from '@/lib/domain/books';

export const dynamic = 'force-dynamic';

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (default today): one line per day + platform sales from Food Hub.
export async function GET(req: Request) {
  const c = await requireMerchant(req);
  if (!isCtx(c)) return c;
  const q = new URL(req.url).searchParams;
  const from = q.get('from') ?? localDate(); const to = q.get('to') ?? from;
  if (!isDate(from) || !isDate(to)) return fail('from / to must be YYYY-MM-DD');
  const r = await rangeBooks(c.merchantId, from, to, tierAtLeast(c.tier, 'vip') ? 400 : 31);
  if (!r.ok) return fail(r.error);
  return ok({ days: r.days, platforms: await platformTotals(c.merchantId, from, to) });
}
