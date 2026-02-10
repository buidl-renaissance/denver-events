import type { MeetupEvent } from '@/types/meetup-graphql';
import { getDb } from '@/db/drizzle';
import { meetupEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** Denver, CO approximate center */
export const DENVER_LAT = 39.7392;
export const DENVER_LON = -104.9903;

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
 * Upsert Meetup events into meetup_events table with full detail.
 */
export async function storeMeetupEventsInDenverDb(
  meetupEventsList: MeetupEvent[]
): Promise<{ inserted: number; updated: number }> {
  if (meetupEventsList.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const db = getDb();
  const now = new Date();
  let inserted = 0;
  let updated = 0;

  for (const meetup of meetupEventsList) {
    const id = `meetup-${meetup.id}`;
    const venueJson = meetup.venue
      ? {
          name: meetup.venue.name,
          address: meetup.venue.address,
          city: meetup.venue.city,
          state: meetup.venue.state,
          country: meetup.venue.country,
        }
      : null;
    const groupJson = meetup.group
      ? {
          name: meetup.group.name,
          urlname: meetup.group.urlname,
          keyGroupPhoto: meetup.group.keyGroupPhoto,
        }
      : null;
    const featuredPhotoJson =
      meetup.featuredEventPhoto ?
        {
          baseUrl: meetup.featuredEventPhoto.baseUrl,
          highResUrl: meetup.featuredEventPhoto.highResUrl,
          id: meetup.featuredEventPhoto.id,
        }
      : null;
    const rsvpsJson = (meetup as Record<string, unknown>).rsvps ?? null;
    const duration = typeof meetup.duration === 'number' ? meetup.duration : null;
    const endTimeVal = typeof meetup.endTime === 'string' ? meetup.endTime : null;

    const row = {
      id,
      meetupId: meetup.id,
      title: meetup.title || 'Untitled Event',
      description: meetup.description ?? null,
      dateTime: meetup.dateTime ?? null,
      duration,
      endTime: endTimeVal,
      eventUrl: meetup.eventUrl ?? null,
      venue: venueJson,
      group: groupJson,
      featuredEventPhoto: featuredPhotoJson,
      rsvps: rsvpsJson,
      eventData: meetup as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
    };

    const existing = await db
      .select({ id: meetupEvents.id })
      .from(meetupEvents)
      .where(eq(meetupEvents.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(meetupEvents)
        .set({
          title: row.title,
          description: row.description,
          dateTime: row.dateTime,
          duration: row.duration,
          endTime: row.endTime,
          eventUrl: row.eventUrl,
          venue: row.venue,
          group: row.group,
          featuredEventPhoto: row.featuredEventPhoto,
          rsvps: row.rsvps,
          eventData: row.eventData,
          updatedAt: now,
        })
        .where(eq(meetupEvents.id, id));
      updated += 1;
    } else {
      await db.insert(meetupEvents).values({
        ...row,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }
  }

  return { inserted, updated };
}
