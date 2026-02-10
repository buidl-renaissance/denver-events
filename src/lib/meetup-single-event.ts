import type { MeetupEvent } from '@/types/meetup-graphql';

/**
 * Fetch event data from Meetup's public HTML page and parse JSON-LD
 * This gets complete event details including endDate
 */
export async function fetchEventFromMeetupUrl(url: string): Promise<MeetupEvent | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract event ID from URL
    const urlMatch = url.match(/\/(\d+)\/?$/);
    const eventId = urlMatch ? urlMatch[1] : '';
    
    // Try to extract JSON-LD structured data (BusinessEvent or Event)
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
    const jsonLdMatches: RegExpMatchArray[] = [];
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      jsonLdMatches.push(match);
    }
    
    for (const match of jsonLdMatches) {
      try {
        const jsonLd = JSON.parse(match[1]);
        if (jsonLd['@type'] === 'BusinessEvent' || jsonLd['@type'] === 'Event') {
          const urlMatch = jsonLd.url?.match(/\/(\d+)\/?$/);
          const extractedEventId = urlMatch ? urlMatch[1] : eventId;
          
          // Parse location/venue data
          let venue: MeetupEvent['venue'];
          if (jsonLd.location) {
            const location = jsonLd.location;
            const address = location.address;
            venue = {
              name: location.name,
              address: typeof address === 'string' 
                ? address 
                : address?.streetAddress || undefined,
              city: address?.addressLocality,
              state: address?.addressRegion,
              country: address?.addressCountry,
            };
          }
          
          // Parse organizer/group data
          let group: MeetupEvent['group'];
          if (jsonLd.organizer) {
            const organizer = jsonLd.organizer;
            const urlname = organizer.url?.match(/meetup\.com\/([^/]+)/)?.[1];
            group = {
              name: organizer.name,
              urlname: urlname,
            };
          }
          
          // Build the complete event object
          const event: MeetupEvent = {
            id: extractedEventId || eventId || '',
            title: jsonLd.name || '',
            description: jsonLd.description || '',
            dateTime: jsonLd.startDate || '',
            endTime: jsonLd.endDate || undefined, // This is the key field we need!
            eventUrl: jsonLd.url || url,
            venue: venue,
            group: group,
            // Calculate duration if we have both start and end
            duration: jsonLd.startDate && jsonLd.endDate
              ? new Date(jsonLd.endDate).getTime() - new Date(jsonLd.startDate).getTime()
              : undefined,
          };
          
          if (event.id && event.title) {
            return event;
          }
        }
      } catch (parseError) {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching event from URL:', error);
    return null;
  }
}

/**
 * Extract endDate from an event's HTML page
 * Lighter-weight version that just gets the endDate
 */
export async function fetchEventEndDate(url: string): Promise<{ endDate?: string; duration?: number } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonLd = JSON.parse(match[1]);
        if ((jsonLd['@type'] === 'BusinessEvent' || jsonLd['@type'] === 'Event') && jsonLd.endDate) {
          const duration = jsonLd.startDate && jsonLd.endDate
            ? new Date(jsonLd.endDate).getTime() - new Date(jsonLd.startDate).getTime()
            : undefined;
          return { endDate: jsonLd.endDate, duration };
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}
