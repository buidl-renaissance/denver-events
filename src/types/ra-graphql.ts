// RA.co GraphQL types (subset for Denver sync)

export interface FilterInputDtoInput {
  areas?: { eq?: number };
  listingDate?: { gte?: string; lte?: string };
  [key: string]: unknown;
}

export interface FilterOptionsInputDtoInput {
  genre?: boolean;
  eventType?: boolean;
  location?: boolean;
  [key: string]: unknown;
}

export interface SortInputDtoInput {
  listingDate?: { order: 'ASCENDING' | 'DESCENDING' };
  score?: { order: 'ASCENDING' | 'DESCENDING' };
  titleKeyword?: { order: 'ASCENDING' | 'DESCENDING' };
  [key: string]: unknown;
}

export interface GetEventListingsVariables {
  filters?: FilterInputDtoInput;
  filterOptions?: FilterOptionsInputDtoInput;
  pageSize?: number;
  page?: number;
  sort?: SortInputDtoInput;
  areaId?: string | number;
}

export interface RAEvent {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  title: string;
  contentUrl?: string;
  flyerFront?: string;
  venue?: {
    id: string;
    name: string;
    contentUrl?: string;
  } | null;
  artists?: Array<{ id: string; name: string }>;
  [key: string]: unknown;
}

export interface EventListing {
  id: string;
  listingDate: string;
  event: RAEvent;
}

export interface EventListingsWithBumps {
  eventListings: {
    data: EventListing[];
    totalResults?: number;
  };
  bumps?: unknown;
}

export interface GetEventListingsResponse {
  data: {
    eventListingsWithBumps: EventListingsWithBumps;
  };
}
