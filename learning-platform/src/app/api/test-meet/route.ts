import { NextResponse } from 'next/server';
import { createGoogleMeet } from '@/lib/googleCalendar';

export async function GET() {
  try {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour from now

    const result = await createGoogleMeet(
      'Test Meeting',
      startTime,
      endTime,
      ['your-email@example.com'] // Replace with your email
    );

    if (!result) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to create Google Meet'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      meetLink: result.meetLink,
      eventId: result.eventId
    });
  } catch (error) {
    console.error('Test Meet Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 