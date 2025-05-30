import { google } from 'googleapis';
import { calendar_v3 } from 'googleapis';

const calendar = google.calendar('v3');

// Only initialize auth if credentials are available
const auth = process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  ? new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })
  : null;

interface GoogleMeetResult {
  meetLink: string;
  eventId: string;
}

export async function createGoogleMeet(
  title: string,
  startTime: Date,
  endTime: Date,
  attendees: string[]
): Promise<GoogleMeetResult | null> {
  // Check if Google Calendar is configured
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('Google Calendar credentials not configured. Please set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env');
    // Return a mock meet link for development/testing
    if (process.env.NODE_ENV === 'development') {
      return {
        meetLink: `https://meet.google.com/mock-${Math.random().toString(36).substring(7)}`,
        eventId: `mock-${Date.now()}`
      };
    }
    return null;
  }

  // If auth is not configured, return null without throwing an error
  if (!auth) {
    console.error('Google Calendar auth failed to initialize');
    return null;
  }

  try {
    console.log('Creating Google Meet with:', {
      title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees
    });

    const event: calendar_v3.Schema$Event = {
      summary: title,
      description: `Learning session: ${title}\n\nParticipants can join using this link.`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
      },
      // Remove attendees to avoid domain-wide delegation requirement
      // We'll share the meet link through our app instead
      conferenceData: {
        createRequest: {
          requestId: `${Date.now()}_${Math.random().toString(36).substring(2)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      // Make the event public so anyone with the link can join
      visibility: 'public',
      guestsCanModify: true,
      guestsCanSeeOtherGuests: true,
    };

    const response = await calendar.events.insert({
      auth,
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
    });

    console.log('Google Calendar API response:', response.data);

    if (!response.data.hangoutLink || !response.data.id) {
      console.error('Failed to create Google Meet link - missing required data in response:', response.data);
      return null;
    }

    return {
      meetLink: response.data.hangoutLink,
      eventId: response.data.id,
    };
  } catch (error) {
    console.error('Error creating Google Meet:', error);
    // Return null instead of throwing error to make video conferencing optional
    return null;
  }
}

export async function deleteGoogleMeet(eventId: string): Promise<void> {
  if (!auth) {
    console.log('Google Calendar integration not configured - skipping Meet deletion');
    return;
  }

  try {
    await calendar.events.delete({
      auth,
      calendarId: 'primary',
      eventId,
    });
  } catch (error) {
    console.error('Error deleting Google Meet:', error);
    // Don't throw error since video conferencing is optional
  }
} 