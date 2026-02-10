import type { RAEvent } from '@/types/ra-graphql';
import { getDb } from '@/db/drizzle';
import { raEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** Denver area ID on RA.co - set RA_DENVER_AREA_ID in env if different */
export const RA_DENVER_AREA_ID = process.env.RA_DENVER_AREA_ID
  ? parseInt(process.env.RA_DENVER_AREA_ID, 10)
  : 519;

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

function toAbsUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `https://ra.co${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Upsert RA events into ra_events table with full detail.
 */
export async function storeRAEventsInDenverDb(
  raEventsList: RAEvent[]
): Promise<{ inserted: number; updated: number }> {
  if (raEventsList.length === 0) return { inserted: 0, updated: 0 };

  const db = getDb();
  const now = new Date();
  let inserted = 0;
  let updated = 0;

  for (const ra of raEventsList) {
    const id = `ra-${ra.id}`;
    const imageUrl =
      toAbsUrl(ra.flyerFront ?? undefined) ||
      toAbsUrl(ra.images?.find((img) => img.type === 'FLYERFRONT')?.filename) ||
      toAbsUrl(ra.images?.[0]?.filename) ||
      null;

    const venueJson = ra.venue
      ? { id: ra.venue.id, name: ra.venue.name, contentUrl: ra.venue.contentUrl }
      : null;
    const artistsJson = ra.artists ?? null;
    const imagesJson = ra.images ?? null;

    const isTicketed =
      ra.isTicketed === true || ra.isTicketed === false ? ra.isTicketed : null;
    const interestedCount =
      typeof (ra as Record<string, unknown>).interestedCount === 'number'
        ? (ra as Record<string, unknown>).interestedCount as number
        : null;

    const row = {
      id,
      raId: ra.id,
      date: ra.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      startTime: ra.startTime ? formatTime(ra.startTime) : null,
      endTime: ra.endTime ? formatTime(ra.endTime) : null,
      title: ra.title || 'Untitled Event',
      contentUrl: ra.contentUrl
        ? (ra.contentUrl.startsWith('http') ? ra.contentUrl : `https://ra.co${ra.contentUrl}`)
        : null,
      flyerFront: ra.flyerFront ?? null,
      imageUrl,
      venue: venueJson,
      artists: artistsJson,
      images: imagesJson,
      isTicketed,
      interestedCount,
      createdAt: now,
      updatedAt: now,
    };

    const existing = await db
      .select({ id: raEvents.id })
      .from(raEvents)
      .where(eq(raEvents.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(raEvents)
        .set({
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          title: row.title,
          contentUrl: row.contentUrl,
          flyerFront: row.flyerFront,
          imageUrl: row.imageUrl,
          venue: row.venue,
          artists: row.artists,
          images: row.images,
          isTicketed: row.isTicketed,
          interestedCount: row.interestedCount,
          updatedAt: now,
        })
        .where(eq(raEvents.id, id));
      updated += 1;
    } else {
      await db.insert(raEvents).values({
        id: row.id,
        raId: row.raId,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        title: row.title,
        contentUrl: row.contentUrl,
        flyerFront: row.flyerFront,
        imageUrl: row.imageUrl,
        venue: row.venue,
        artists: row.artists,
        images: row.images,
        isTicketed: row.isTicketed,
        interestedCount: row.interestedCount,
      });
      inserted += 1;
    }
  }
  return { inserted, updated };
}
