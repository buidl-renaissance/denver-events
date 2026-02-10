/**
 * Script to enrich Meetup events with endDate/duration by fetching individual event pages.
 * Run with: yarn ts-node scripts/enrich-meetup-events.ts
 */
import { getDb } from '../src/db/drizzle';
import { meetupEvents } from '../src/db/schema';
import { fetchEventEndDate } from '../src/lib/meetup-single-event';
import { eq, isNull, and, isNotNull } from 'drizzle-orm';

async function main() {
  console.log('🔄 Enriching Meetup events with end times...\n');
  
  const db = getDb();
  
  // Get all events that have an eventUrl but no duration/endTime
  const eventsToEnrich = await db
    .select()
    .from(meetupEvents)
    .where(
      and(
        isNotNull(meetupEvents.eventUrl),
        isNull(meetupEvents.duration),
        isNull(meetupEvents.endTime)
      )
    );
  
  console.log(`Found ${eventsToEnrich.length} events to enrich\n`);
  
  let enriched = 0;
  let failed = 0;
  
  for (const event of eventsToEnrich) {
    if (!event.eventUrl) continue;
    
    console.log(`📡 Fetching: ${event.title}`);
    console.log(`   URL: ${event.eventUrl}`);
    
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
        
        console.log(`   ✅ Got endDate: ${result.endDate}, duration: ${result.duration}ms`);
        enriched++;
      } else {
        console.log(`   ⚠️ No endDate found in JSON-LD`);
        failed++;
      }
      
      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      failed++;
    }
  }
  
  console.log(`\n✅ Done! Enriched: ${enriched}, Failed: ${failed}`);
}

main().catch(console.error);
