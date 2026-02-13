import { fetchMeetupGraphQL } from './meetup-graphql';
import {
  extractMeetupEventsFromResponse,
  storeMeetupEventsInDenverDb,
  DENVER_LAT,
  DENVER_LON,
} from './meetup-sync';
import type {
  MeetupGraphQLRequest,
  MeetupGraphQLResponse,
  RecommendedEventsVariables,
} from '@/types/meetup-graphql';

/**
 * Format date with timezone for Meetup API
 */
export function formatDateWithTimezone(
  date: Date,
  timezone: string = 'America/Denver'
): string {
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}[${timezone}]`;
}

const PERSISTED_QUERY_HASH = 'cf6348a7edb376af58158519e78130eb8beced0aaaed60ab379e82f25fd52eea';

/** Default variables: Denver area, upcoming events */
export const defaultVariables: RecommendedEventsVariables = {
  first: 96,
  lat: DENVER_LAT,
  lon: DENVER_LON,
  startDateRange: formatDateWithTimezone(new Date()),
  numberOfEventsForSeries: 5,
  seriesStartDate: new Date().toISOString().split('T')[0],
  sortField: 'RELEVANCE',
  doConsolidateEvents: true,
  doPromotePaypalEvents: false,
  indexAlias: '"{\\"filterOutWrongLanguage\\": \\"true\\",\\"modelVersion\\": \\"split_offline_online\\"}"',
  dataConfiguration: JSON.stringify({
    isSimplifiedSearchEnabled: true,
    include_events_from_user_chapters: true,
  }),
};

export function prepareRequestVariables(
  variables?: Partial<RecommendedEventsVariables>
): RecommendedEventsVariables {
  return {
    ...defaultVariables,
    ...variables,
    startDateRange: formatDateWithTimezone(new Date()),
    seriesStartDate: new Date().toISOString().split('T')[0],
  };
}

export function buildGraphQLRequest(
  variables: RecommendedEventsVariables
): MeetupGraphQLRequest {
  return {
    operationName: 'recommendedEventsWithSeries',
    variables: variables as Record<string, unknown>,
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: PERSISTED_QUERY_HASH,
      },
    },
  };
}

export async function fetchEventsFromMeetup(
  request: MeetupGraphQLRequest
): Promise<MeetupGraphQLResponse> {
  const response = await fetchMeetupGraphQL<{ result?: { edges?: unknown[] } }>(request);
  if (response.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
  }
  return response;
}

export function extractEventCount(response: { data?: unknown }): number {
  const data = response.data as { result?: { edges?: unknown[] } } | undefined;
  const edges = data?.result?.edges ?? [];
  return edges.length;
}

/**
 * Fetch Denver-area Meetup events and store them in the denver-events database.
 */
export async function fetchAndStoreDenverMeetupEvents(
  variables?: Partial<RecommendedEventsVariables>
): Promise<{ eventCount: number; inserted: number; updated: number }> {
  const requestVariables = prepareRequestVariables(variables);
  const graphQLRequest = buildGraphQLRequest(requestVariables);
  const response = await fetchEventsFromMeetup(graphQLRequest);
  const eventCount = extractEventCount(response);

  const meetupEvents = extractMeetupEventsFromResponse(
    (response.data ?? {}) as { result?: { edges?: Array<{ node?: import('@/types/meetup-graphql').MeetupEvent }> } }
  );
  const { inserted, updated } = await storeMeetupEventsInDenverDb(meetupEvents);

  return { eventCount, inserted, updated };
}
