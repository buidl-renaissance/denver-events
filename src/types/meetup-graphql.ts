// GraphQL Request Types (for Meetup API sync)
export interface MeetupGraphQLRequest {
  operationName: string;
  variables: Record<string, unknown>;
  extensions?: {
    persistedQuery?: {
      version: number;
      sha256Hash: string;
    };
  };
}

export interface MeetupGraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

export interface RecommendedEventsVariables {
  first?: number;
  lat?: number;
  lon?: number;
  radius?: number;
  startDateRange?: string;
  eventType?: string;
  numberOfEventsForSeries?: number;
  seriesStartDate?: string;
  sortField?: string;
  doConsolidateEvents?: boolean;
  doPromotePaypalEvents?: boolean;
  indexAlias?: string;
  dataConfiguration?: string;
  after?: string;
}

export interface MeetupEvent {
  id: string;
  title: string;
  description?: string;
  dateTime?: string;
  eventUrl?: string;
  venue?: {
    id?: string;
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
  group?: {
    id?: string;
    name?: string;
    urlname?: string;
    city?: string;
    state?: string;
    country?: string;
    keyGroupPhoto?: {
      baseUrl?: string;
      highResUrl?: string;
      id?: string;
    };
  };
  series?: {
    id?: string;
    title?: string;
  };
  featuredEventPhoto?: {
    baseUrl?: string;
    highResUrl?: string;
    id?: string;
  };
  [key: string]: unknown;
}
