import { config } from 'dotenv';
import { join } from 'path';
import { fetchAndStoreDenverMeetupEvents } from '../src/lib/meetup-fetch';
import type { RecommendedEventsVariables } from '../src/types/meetup-graphql';

config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

/**
 * Fetch Meetup events for Denver and store in denver-events database.
 *
 * Usage:
 *   yarn sync:meetup
 *   yarn sync:meetup first=20
 *   yarn sync:meetup lat=39.74 lon=-104.99 first=30
 *
 * Override with key=value args (lat/lon/first etc.).
 */
const args = process.argv.slice(2);
const customVariables: Partial<RecommendedEventsVariables> = {};

for (const arg of args) {
  if (arg.includes('=')) {
    const [key, value] = arg.split('=');
    let parsedValue: string | number | boolean = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value))) parsedValue = Number(value);
    (customVariables as Record<string, string | number | boolean>)[key] = parsedValue;
  }
}

fetchAndStoreDenverMeetupEvents(customVariables)
  .then((result) => {
    console.log(
      `✅ Denver Meetup sync done. Fetched: ${result.eventCount}, inserted: ${result.inserted}, updated: ${result.updated}`
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
