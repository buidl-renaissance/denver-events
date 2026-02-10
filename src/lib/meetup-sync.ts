import type { MeetupEvent } from '@/types/meetup-graphql';
import { getDb } from '@/db/drizzle';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** Denver, CO approximate center */
export const DENVER_LAT = 39.7392;
export const DENVER_LON = -104.9903;

const NOTES_MAX_LENGTH = 2000;

/**
 * Map a Meetup event to the denver-events schema (same shape as API/mobile).
 */
export function mapMeetupEventToDenverEvent(meetup: MeetupEvent): {
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
} {
  const id = `meetup-${meetup.id}`;
  const dateTime = meetup.dateTime ? new Date(meetup.dateTime) : null;
  const eventDate = dateTime
    ? dateTime.toISOString().slice(0, 10)
    : '';
  const startTime = dateTime
    ? dateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '12:00 AM';

  let venue = '';
  if (meetup.venue?.name) {
    venue = meetup.venue.name;
    if (meetup.venue.address || meetup.venue.city) {
      const parts = [meetup.venue.address, meetup.venue.city].filter(Boolean);
      if (parts.length) venue += `, ${parts.join(', ')}`;
    }
  } else if (meetup.venue?.address || meetup.venue?.city) {
    venue = [meetup.venue.address, meetup.venue.city].filter(Boolean).join(', ');
  }

  const notes = meetup.description
    ? meetup.description.slice(0, NOTES_MAX_LENGTH)
    : null;

  return {
    id,
    eventDate: eventDate || new Date().toISOString().slice(0, 10),
    startTime: startTime || '12:00 AM',
    endTime: null,
    eventName: meetup.title || 'Untitled Event',
    organizer: meetup.group?.name ?? null,
    venue,
    registrationUrl: meetup.eventUrl ?? null,
    imageUrl: null,
    notes,
  };
}

/**
 * Extract Meetup events from GraphQL response (data.result.edges).
 */
export function extractMeetupEventsFromResponse(data: {
  result?: { edges?: Array<{ node?: MeetupEvent }> };
}): MeetupEvent[] {
  const edges = data?.result?.edges ?? [];
  const out: MeetupEvent[] = [];
  for (const edge of edges) {
    if (edge.node) out.push(edge.node);
  }
  return out;
}

/**
 * Upsert Meetup-sourced events into the denver-events table.
 * Uses event id (meetup-{id}) for conflict; updates existing rows.
 */
export async function storeMeetupEventsInDenverDb(
  meetupEvents: MeetupEvent[]
): Promise<{ inserted: number; updated: number }> {
  if (meetupEvents.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const db = getDb();
  const now = new Date();
  let inserted = 0;
  let updated = 0;

  for (const meetup of meetupEvents) {
    const row = mapMeetupEventToDenverEvent(meetup);
    const existing = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, row.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(events)
        .set({
          eventDate: row.eventDate,
          startTime: row.startTime,
          endTime: row.endTime,
          eventName: row.eventName,
          organizer: row.organizer,
          venue: row.venue,
          registrationUrl: row.registrationUrl,
          imageUrl: row.imageUrl,
          notes: row.notes,
          updatedAt: now,
        })
        .where(eq(events.id, row.id));
      updated += 1;
    } else {
      await db.insert(events).values({
        id: row.id,
        eventDate: row.eventDate,
        startTime: row.startTime,
        endTime: row.endTime,
        eventName: row.eventName,
        organizer: row.organizer,
        venue: row.venue,
        registrationUrl: row.registrationUrl,
        imageUrl: row.imageUrl,
        notes: row.notes,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }
  }

  return { inserted, updated };
}
