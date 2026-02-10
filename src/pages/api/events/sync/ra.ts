import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchAndStoreDenverRAEvents } from '@/lib/ra-fetch';

type SyncResponse =
  | {
      ok: true;
      eventCount: number;
      inserted: number;
      updated: number;
      pagesProcessed: number;
    }
  | { ok: false; error: string };

/**
 * POST /api/events/sync/ra
 * Fetches Denver-area RA (Resident Advisor) events and upserts them into the events table.
 * Query: maxPages=10, dateFrom=YYYY-MM-DD, dateTo=YYYY-MM-DD (optional)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SyncResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const maxPages = req.query.maxPages ? Number(req.query.maxPages) : undefined;
    const dateFrom =
      typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo =
      typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;

    const result = await fetchAndStoreDenverRAEvents({
      maxPages,
      dateFrom,
      dateTo,
    });
    return res.status(200).json({
      ok: true,
      eventCount: result.eventCount,
      inserted: result.inserted,
      updated: result.updated,
      pagesProcessed: result.pagesProcessed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('RA sync error:', err);
    return res.status(500).json({ ok: false, error: message });
  }
}
