import type {
  MeetupGraphQLRequest,
  MeetupGraphQLResponse,
} from '@/types/meetup-graphql';

const MEETUP_GRAPHQL_ENDPOINT = 'https://www.meetup.com/gql2';

export async function fetchMeetupGraphQL<T = unknown>(
  request: MeetupGraphQLRequest
): Promise<MeetupGraphQLResponse<T>> {
  const response = await fetch(MEETUP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US',
      'apollographql-client-name': 'nextjs-web',
      'content-type': 'application/json',
      'origin': 'https://www.meetup.com',
      'referer': 'https://www.meetup.com/find/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      `Meetup GraphQL API error: ${response.status} ${response.statusText}`
    );
  }

  const data: MeetupGraphQLResponse<T> = await response.json();

  if (data.errors && data.errors.length > 0) {
    const errorMessages = data.errors.map((e) => e.message).join(', ');
    throw new Error(`GraphQL errors: ${errorMessages}`);
  }

  return data;
}
