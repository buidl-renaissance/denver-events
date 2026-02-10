import type { RAEvent } from '@/types/ra-graphql';
import { getDb } from '@/db/drizzle';
import { events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/** Denver area ID on RA.co - set RA_DENVER_AREA_ID in env if different */
export const RA_DENVER_AREA_ID = process.env.RA_DENVER_AREA_ID
  ? parseInt(process.env.RA_DENVER_AREA_ID, 10)
  : 519;

const NOTES_MAX_LENGTH = 2000;

function formatTime(isoOrTime?: string): string {
  if (!isoOrTime) return '12:00 AM';
  const d = new Date(isoOrTime);
  if (Number.isNaN(d.getTime())) return isoOrTime;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Map an RA event to the denver-events schema (same shape as API/mobile).
 */
export function mapRAEventToDenverEvent(ra: RAEvent): {
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
  const id = `ra-${ra.id}`;
  const eventDate = ra.date?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const startTime = formatTime(ra.startTime);
  const endTime = ra.endTime ? formatTime(ra.endTime) : null;
  const venue = ra.venue?.name ?? '';
  const artistNames =
    ra.artists?.length ? ra.artists.map((a) => a.name).join(', ') : null;
  const registrationUrl = ra.contentUrl
    ? (ra.contentUrl.startsWith('http') ? ra.contentUrl : `https://ra.co${ra.contentUrl}`)
    : null;
  const imageUrl = ra.flyerFront ?? null;
  const notes =
    artistNames && artistNames.length <= NOTES_MAX_LENGTH
      ? artistNames
      : artistNames
        ? artistNames.slice(0, NOTES_MAX_LENGTH)
        : null;

  return {
    id,
    eventDate,
    startTime: startTime || '12:00 AM',
    endTime,
    eventName: ra.title || 'Untitled Event',
    organizer: artistNames,
    venue,
    registrationUrl,
    imageUrl,
    notes,
  };
}

/**
 * Upsert RA-sourced events into the denver-events table.
 */
export async function storeRAEventsInDenverDb(
  raEvents: RAEvent[]
): Promise<{ inserted: number; updated: number }> {
  if (raEvents.length === 0) return { inserted: 0, updated: 0 };

  const db = getDb();
  const now = new Date();
  let inserted = 0;
  let updated = 0;

  for (const ra of raEvents) {
    const row = mapRAEventToDenverEvent(ra);
    const existingById = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, row.id))
      .limit(1);

    if (existingById.length > 0) {
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
      continue;
    }

    const existingByKey = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.eventDate, row.eventDate),
          eq(events.eventName, row.eventName),
          eq(events.startTime, row.startTime)
        )
      )
      .limit(1);

    if (existingByKey.length > 0) {
      await db
        .update(events)
        .set({
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
          updatedAt: now,
        })
        .where(eq(events.id, existingByKey[0].id));
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
