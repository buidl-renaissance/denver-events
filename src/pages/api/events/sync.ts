import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchAndStoreDenverMeetupEvents } from '@/lib/meetup-fetch';

type SyncResponse =
  | { ok: true; eventCount: number; inserted: number; updated: number }
  | { ok: false; error: string };

/**
 * POST /api/events/sync
 * Fetches Denver-area Meetup events and upserts them into the events table.
 * Optional query: first=48 (limit), lat=39.7392, lon=-104.9903
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SyncResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const first = req.query.first ? Number(req.query.first) : undefined;
    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lon = req.query.lon ? Number(req.query.lon) : undefined;
    const variables = [first, lat, lon].some((x) => x !== undefined)
      ? { first, lat, lon }
      : undefined;

    const result = await fetchAndStoreDenverMeetupEvents(variables);
    return res.status(200).json({
      ok: true,
      eventCount: result.eventCount,
      inserted: result.inserted,
      updated: result.updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Events sync error:', err);
    return res.status(500).json({ ok: false, error: message });
  }
}
