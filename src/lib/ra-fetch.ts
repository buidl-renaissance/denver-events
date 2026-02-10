import { fetchRAEventListings } from './ra-co';
import { storeRAEventsInDenverDb, RA_DENVER_AREA_ID } from './ra-sync';
import type { GetEventListingsVariables } from '@/types/ra-graphql';

export interface FetchAndStoreRAOptions {
  areaId?: number;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  maxPages?: number;
}

/**
 * Fetch RA events for Denver and store in denver-events database.
 * Paginates until no more results or maxPages reached.
 */
export async function fetchAndStoreDenverRAEvents(
  options: FetchAndStoreRAOptions = {}
): Promise<{
  eventCount: number;
  inserted: number;
  updated: number;
  pagesProcessed: number;
}> {
  const areaId = options.areaId ?? RA_DENVER_AREA_ID;
  const today = new Date().toISOString().split('T')[0];
  const dateFrom = options.dateFrom ?? today;
  const pageSize = options.pageSize ?? 20;
  const maxPages = options.maxPages ?? 10;

  const variables: GetEventListingsVariables = {
    areaId,
    pageSize,
    page: 1,
    filterOptions: { genre: true, eventType: true },
    filters: {
      areas: { eq: areaId },
      listingDate: { gte: dateFrom },
    },
    sort: {
      listingDate: { order: 'ASCENDING' },
      score: { order: 'DESCENDING' },
      titleKeyword: { order: 'ASCENDING' },
    },
  };
  if (options.dateTo) {
    variables.filters!.listingDate!.lte = options.dateTo;
  }

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalFetched = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore && (!maxPages || page <= maxPages)) {
    variables.page = page;
    const response = await fetchRAEventListings(variables);
    const eventListings = response.data.eventListingsWithBumps.eventListings;
    const list = eventListings.data ?? [];
    const totalResults = eventListings.totalResults ?? 0;

    if (list.length === 0) break;

    const raEvents = list.map((l) => l.event);
    const { inserted, updated } = await storeRAEventsInDenverDb(raEvents);
    totalInserted += inserted;
    totalUpdated += updated;
    totalFetched += raEvents.length;

    if (totalResults > 0 && page * pageSize >= totalResults) hasMore = false;
    else if (list.length < pageSize) hasMore = false;
    else page += 1;

    if (hasMore) await new Promise((r) => setTimeout(r, 400));
  }

  return {
    eventCount: totalFetched,
    inserted: totalInserted,
    updated: totalUpdated,
    pagesProcessed: page,
  };
}
