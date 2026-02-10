import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db/drizzle';
import { meetupEvents, raEvents } from '@/db/schema';

/** Unified event shape for mobile app (same as before) */
export type UnifiedEvent = {
  id: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  eventName: string;
  organizer: string | null;
  venue: string;
  registrationUrl: string | null;
  imageUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Optional: 'meetup' | 'ra' for extra detail in app */
  eventSource?: 'meetup' | 'ra';
  /** Meetup: number of attendees/RSVPs */
  attendeeCount?: number | null;
  /** RA: number interested */
  interestedCount?: number | null;
};

function meetupRowToUnified(row: typeof meetupEvents.$inferSelect): UnifiedEvent {
  const dateTime = row.dateTime ? new Date(row.dateTime) : null;
  const eventDate = dateTime ? dateTime.toISOString().slice(0, 10) : '';
  const startTime = dateTime
    ? dateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '12:00 AM';
  type VenueObj = { name?: string; address?: string; city?: string };
  type GroupObj = { name?: string; keyGroupPhoto?: { highResUrl?: string; baseUrl?: string } };
  type FeaturedObj = { highResUrl?: string; baseUrl?: string };
  const venueObj = row.venue as VenueObj | null;
  const venue = venueObj && typeof venueObj === 'object'
    ? [venueObj.name, venueObj.address, venueObj.city].filter(Boolean).join(', ')
    : '';
  const group = row.group as GroupObj | null;
  const featured = row.featuredEventPhoto as FeaturedObj | null;
  const imageUrl =
    (featured?.highResUrl || featured?.baseUrl) ??
    (group?.keyGroupPhoto
      ? (group.keyGroupPhoto.highResUrl || group.keyGroupPhoto.baseUrl)
      : null);
  const notes =
    row.description && row.description.length > 2000
      ? row.description.slice(0, 2000)
      : row.description;

  type RsvpsObj = { totalCount?: number; yesRsvpCount?: number; goingCount?: number };
  const rsvps = row.rsvps as RsvpsObj | null;
  const attendeeCount =
    rsvps && typeof rsvps === 'object'
      ? rsvps.totalCount ?? rsvps.yesRsvpCount ?? rsvps.goingCount ?? null
      : null;

  return {
    id: row.id,
    eventDate: eventDate || new Date().toISOString().slice(0, 10),
    startTime: startTime || '12:00 AM',
    endTime: null,
    eventName: row.title,
    organizer: group?.name ?? null,
    venue,
    registrationUrl: row.eventUrl ?? null,
    imageUrl: imageUrl ?? null,
    notes: notes ?? null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    eventSource: 'meetup',
    attendeeCount: attendeeCount ?? null,
    interestedCount: null,
  };
}

function raRowToUnified(row: typeof raEvents.$inferSelect): UnifiedEvent {
  const artists = Array.isArray(row.artists) ? row.artists : [];
  const artistNames = artists.length
    ? artists.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
    : null;
  const venueName =
    row.venue && typeof row.venue === 'object' && row.venue !== null
      ? (row.venue as { name?: string }).name ?? ''
      : '';

  return {
    id: row.id,
    eventDate: row.date,
    startTime: row.startTime || '12:00 AM',
    endTime: row.endTime ?? null,
    eventName: row.title,
    organizer: artistNames ?? null,
    venue: venueName,
    registrationUrl: row.contentUrl ?? null,
    imageUrl: row.imageUrl ?? null,
    notes: artistNames ?? null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    eventSource: 'ra',
    attendeeCount: null,
    interestedCount: row.interestedCount ?? null,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ events: UnifiedEvent[] } | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDb();
    const { eventDate: queryDate, limit, offset } = req.query;

    const limitNum = typeof limit === 'string' ? Math.min(parseInt(limit, 10) || 500, 500) : 500;
    const offsetNum = typeof offset === 'string' ? Math.max(0, parseInt(offset, 10) || 0) : 0;

    const dateFilter =
      typeof queryDate === 'string' && queryDate ? queryDate : null;

    const [meetupRows, raRows] = await Promise.all([
      dateFilter
        ? db
            .select()
            .from(meetupEvents)
            .where(
              sql`substr(${meetupEvents.dateTime}, 1, 10) = ${dateFilter}`
            )
            .orderBy(meetupEvents.dateTime)
        : db.select().from(meetupEvents).orderBy(meetupEvents.dateTime),
      dateFilter
        ? db
            .select()
            .from(raEvents)
            .where(eq(raEvents.date, dateFilter))
            .orderBy(raEvents.date, raEvents.startTime)
        : db.select().from(raEvents).orderBy(raEvents.date, raEvents.startTime),
    ]);

    const meetupUnified = meetupRows.map(meetupRowToUnified);
    const raUnified = raRows.map(raRowToUnified);
    const combined: UnifiedEvent[] = [...meetupUnified, ...raUnified];

    combined.sort((a, b) => {
      const d = a.eventDate.localeCompare(b.eventDate);
      if (d !== 0) return d;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const eventsList = combined.slice(offsetNum, offsetNum + limitNum);

    return res.status(200).json({ events: eventsList });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Events list error:', err);
    return res.status(500).json({ error: message });
  }
}
