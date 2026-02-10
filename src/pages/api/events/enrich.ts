import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/db/drizzle';
import { meetupEvents } from '@/db/schema';
import { fetchEventEndDate } from '@/lib/meetup-single-event';
import { eq, isNull, and, isNotNull } from 'drizzle-orm';

type EnrichResponse =
  | { ok: true; total: number; enriched: number; failed: number }
  | { ok: false; error: string };

/**
 * POST /api/events/enrich
 * Enriches Meetup events with end times by fetching individual event pages.
 * Optional query: limit=10 (max events to enrich per call)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EnrichResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const db = getDb();

    // Get events that have an eventUrl but no duration/endTime
    const eventsToEnrich = await db
      .select()
      .from(meetupEvents)
      .where(
        and(
          isNotNull(meetupEvents.eventUrl),
          isNull(meetupEvents.duration),
          isNull(meetupEvents.endTime)
        )
      )
      .limit(limit);

    let enriched = 0;
    let failed = 0;

    for (const event of eventsToEnrich) {
      if (!event.eventUrl) continue;

      try {
        const result = await fetchEventEndDate(event.eventUrl);

        if (result && (result.endDate || result.duration)) {
          await db
            .update(meetupEvents)
            .set({
              endTime: result.endDate ?? null,
              duration: result.duration ?? null,
              updatedAt: new Date(),
            })
            .where(eq(meetupEvents.id, event.id));
          enriched++;
        } else {
          // Mark as processed even if no endDate found (so we don't retry)
          // Set duration to 0 to indicate we tried but found nothing
          await db
            .update(meetupEvents)
            .set({
              duration: 0,
              updatedAt: new Date(),
            })
            .where(eq(meetupEvents.id, event.id));
          failed++;
        }

        // Rate limit: wait 300ms between requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch {
        failed++;
      }
    }

    return res.status(200).json({
      ok: true,
      total: eventsToEnrich.length,
      enriched,
      failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Events enrich error:', err);
    return res.status(500).json({ ok: false, error: message });
  }
}
