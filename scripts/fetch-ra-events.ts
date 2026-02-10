import { config } from 'dotenv';
import { join } from 'path';
import { fetchAndStoreDenverRAEvents } from '../src/lib/ra-fetch';

config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

/**
 * Fetch RA (Resident Advisor) events for Denver and cache in denver-events DB.
 *
 * Set RA_DENVER_AREA_ID in .env to Denver's area ID on RA.co if needed (default 20).
 *
 * Usage:
 *   yarn sync:ra
 *   yarn sync:ra --maxPages 5
 *   yarn sync:ra --dateFrom 2025-02-01 --dateTo 2025-02-28
 */
const args = process.argv.slice(2);
let maxPages: number | undefined;
let dateFrom: string | undefined;
let dateTo: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--maxPages' && args[i + 1]) {
    maxPages = parseInt(args[i + 1], 10);
    i += 1;
  } else if (args[i] === '--dateFrom' && args[i + 1]) {
    dateFrom = args[i + 1];
    i += 1;
  } else if (args[i] === '--dateTo' && args[i + 1]) {
    dateTo = args[i + 1];
    i += 1;
  }
}

fetchAndStoreDenverRAEvents({ maxPages, dateFrom, dateTo })
  .then((result) => {
    console.log(
      `✅ Denver RA sync done. Fetched: ${result.eventCount}, inserted: ${result.inserted}, updated: ${result.updated}, pages: ${result.pagesProcessed}`
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ RA sync failed:', err);
    process.exit(1);
  });
