import type { GetEventListingsVariables, GetEventListingsResponse } from '@/types/ra-graphql';

const RA_CO_GRAPHQL_ENDPOINT = 'https://ra.co/graphql';

// Full query matching ra-events app-block (required by RA.co API)
const GET_EVENT_LISTINGS_WITH_BUMPS = `
  query GET_EVENT_LISTINGS_WITH_BUMPS($filters: FilterInputDtoInput, $filterOptions: FilterOptionsInputDtoInput, $page: Int, $pageSize: Int, $sort: SortInputDtoInput, $areaId: ID) {
    eventListingsWithBumps(
      filters: $filters
      filterOptions: $filterOptions
      pageSize: $pageSize
      page: $page
      sort: $sort
      areaId: $areaId
    ) {
      eventListings {
        data {
          id
          listingDate
          event {
            ...eventListingsFields
            __typename
          }
          __typename
        }
        filterOptions {
          genre { label value count __typename }
          eventType { value count __typename }
          location { value { from to __typename } count __typename }
          __typename
        }
        totalResults
        __typename
      }
      bumps {
        bumpDecision {
          id
          date
          eventId
          event { ...eventListingsFields __typename }
          __typename
        }
        __typename
      }
      __typename
    }
  }
  fragment eventListingsFields on Event {
    id
    date
    startTime
    endTime
    title
    contentUrl
    flyerFront
    venue { id name contentUrl live __typename }
    artists { id name __typename }
    __typename
  }
`;

/** Normalize variables for RA.co: areaId as string (GraphQL ID), strip undefined */
function normalizeVariables(
  variables: GetEventListingsVariables
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    pageSize: variables.pageSize,
    page: variables.page,
    filterOptions: variables.filterOptions,
    filters: variables.filters,
    sort: variables.sort,
  };
  if (variables.areaId != null) {
    out.areaId = String(variables.areaId);
  }
  return out;
}

export async function fetchRAEventListings(
  variables: GetEventListingsVariables
): Promise<GetEventListingsResponse> {
  const res = await fetch(RA_CO_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://ra.co',
      'Referer': 'https://ra.co/events/us/denver',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'ra-content-language': 'en',
    },
    body: JSON.stringify({
      operationName: 'GET_EVENT_LISTINGS_WITH_BUMPS',
      query: GET_EVENT_LISTINGS_WITH_BUMPS,
      variables: normalizeVariables(variables),
    }),
  });

  if (!res.ok) {
    throw new Error(`RA.co API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`RA.co GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  if (!json.data?.eventListingsWithBumps) {
    throw new Error('Invalid RA.co response');
  }
  return { data: { eventListingsWithBumps: json.data.eventListingsWithBumps } };
}
