import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql, and, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db/drizzle';
import { meetupEvents, raEvents } from '@/db/schema';

const DENVER_TZ = 'America/Denver';

/** Parse "h:mm a" to 24h hour and minute */
function parseTime12h(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr?.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const pm = (match[3] || '').toLowerCase() === 'pm';
  if (hour === 12) hour = pm ? 12 : 0;
  else if (pm) hour += 12;
  return { hour: hour % 24, minute: minute % 60 };
}

/** Get UTC offset in hours for Denver at the given date (YYYY-MM-DD). Denver is behind UTC. */
function getDenverOffsetHours(dateStr: string): number {
  const ref = new Date(dateStr + 'T12:00:00.000Z');
  const denverHour = parseInt(
    ref.toLocaleString('en-US', { timeZone: DENVER_TZ, hour: 'numeric', hour12: false }),
    10
  );
  return 12 - denverHour;
}

/** Return event end as UTC Date, or null if unparseable. Uses eventDate + endTime, or eventDate + startTime + 2h. */
function getEventEndUtc(event: UnifiedEvent): Date | null {
  const [y, m, d] = (event.eventDate || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const timePart = event.endTime || event.startTime;
  const parsed = timePart ? parseTime12h(timePart) : { hour: 0, minute: 0 };
  const hour = parsed?.hour ?? 0;
  const minute = parsed?.minute ?? 0;
  const offsetHours = getDenverOffsetHours(event.eventDate);
  let endHour = hour;
  let endMinute = minute;
  let endDay = d;
  if (!event.endTime && event.startTime) {
    endHour = hour + 2;
    if (endHour >= 24) {
      endHour -= 24;
      endDay += 1;
    }
  }
  const utcHour = endHour + offsetHours;
  const utcDay = endDay + Math.floor(utcHour / 24);
  const utcHourInDay = ((utcHour % 24) + 24) % 24;
  return new Date(Date.UTC(y, m - 1, utcDay, utcHourInDay, endMinute, 0, 0));
}

/** Keep only ongoing or future events (event end >= now) */
function filterOngoingOrFuture(events: UnifiedEvent[]): UnifiedEvent[] {
  const now = new Date();
  return events.filter((event) => {
    const end = getEventEndUtc(event);
    return end && end >= now;
  });
}

/** Exclude Meetup events that are online-only */
const meetupExcludeOnline = and(
  isNotNull(meetupEvents.venue),
  sql`(json_extract(${meetupEvents.eventData}, '$.isOnline') IS NULL OR json_extract(${meetupEvents.eventData}, '$.isOnline') != 1)`,
  sql`(json_extract(${meetupEvents.venue}, '$.name') IS NULL OR lower(json_extract(${meetupEvents.venue}, '$.name')) NOT LIKE '%online%')`,
  sql`(json_extract(${meetupEvents.eventData}, '$.venueType') IS NULL OR lower(json_extract(${meetupEvents.eventData}, '$.venueType')) NOT IN ('online', 'virtual'))`
);

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
  const DENVER_TZ = 'America/Denver';
  // Format date in Denver timezone
  const eventDate = dateTime
    ? dateTime.toLocaleDateString('en-CA', { timeZone: DENVER_TZ }) // en-CA gives YYYY-MM-DD format
    : '';
  const startTime = dateTime
    ? dateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: DENVER_TZ })
    : '12:00 AM';

  // Calculate end time from duration (in milliseconds) or endTime column
  // Note: duration=0 means we tried to fetch but found nothing, so skip it
  let endTime: string | null = null;
  if (dateTime && row.duration && row.duration > 0) {
    const endDateTime = new Date(dateTime.getTime() + row.duration);
    endTime = endDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: DENVER_TZ });
  } else if (row.endTime && typeof row.endTime === 'string') {
    const endDateTime = new Date(row.endTime);
    if (!isNaN(endDateTime.getTime())) {
      endTime = endDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: DENVER_TZ });
    }
  } else {
    // Fallback: check eventData for duration/endTime
    type EventDataObj = { duration?: number; endTime?: string; [key: string]: unknown };
    const eventData = row.eventData as EventDataObj | null;
    if (dateTime && eventData?.duration && typeof eventData.duration === 'number') {
      const endDateTime = new Date(dateTime.getTime() + eventData.duration);
      endTime = endDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: DENVER_TZ });
    } else if (eventData?.endTime && typeof eventData.endTime === 'string') {
      const endDateTime = new Date(eventData.endTime);
      if (!isNaN(endDateTime.getTime())) {
        endTime = endDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: DENVER_TZ });
      }
    }
  }

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
    endTime,
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

/** Normalize RA URL to path-only so mobile app can safely prepend https://ra.co */
function raContentUrlToPath(url: string | null): string | null {
  if (!url || !url.trim()) return null;
  const u = url.trim();
  if (u.startsWith('https://ra.co')) return u.slice(14) || '/';
  if (u.startsWith('http://ra.co')) return u.slice(13) || '/';
  return u.startsWith('/') ? u : `/${u}`;
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
    registrationUrl: raContentUrlToPath(row.contentUrl ?? null),
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

    const meetupWhere = dateFilter
      ? and(
          sql`substr(${meetupEvents.dateTime}, 1, 10) = ${dateFilter}`,
          meetupExcludeOnline
        )
      : meetupExcludeOnline;

    const [meetupRows, raRows] = await Promise.all([
      db
        .select()
        .from(meetupEvents)
        .where(meetupWhere)
        .orderBy(meetupEvents.dateTime),
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
    let combined: UnifiedEvent[] = [...meetupUnified, ...raUnified];

    combined = filterOngoingOrFuture(combined);

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
