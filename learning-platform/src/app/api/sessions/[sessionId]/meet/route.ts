import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createGoogleMeet } from '@/lib/googleCalendar';

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get and validate sessionId
    if (!params?.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const parsedSessionId = parseInt(params.sessionId);
    if (isNaN(parsedSessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Get session details
    const learningSession = await prisma.session.findUnique({
      where: { id: parsedSessionId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    if (!learningSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (learningSession.createdById !== user.id) {
      return NextResponse.json(
        { error: 'Only the session creator can create a meeting' },
        { status: 403 }
      );
    }

    // Check if session is in progress
    if (learningSession.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Can only create meetings for sessions that are in progress' },
        { status: 400 }
      );
    }

    // Check if meeting already exists
    if (learningSession.meetLink) {
      return NextResponse.json(
        { error: 'Meeting already exists for this session' },
        { status: 400 }
      );
    }

    // Create Google Meet
    const attendeeEmails = learningSession.participants.map((p: any) => p.user.email);
    const meetResult = await createGoogleMeet(
      learningSession.title,
      learningSession.startTime,
      learningSession.endTime,
      attendeeEmails
    );

    if (!meetResult) {
      return NextResponse.json(
        { error: 'Failed to create Google Meet' },
        { status: 500 }
      );
    }

    // Update session with meet info
    const updatedSession = await prisma.session.update({
      where: { id: parsedSessionId },
      data: {
        meetLink: meetResult.meetLink,
        googleEventId: meetResult.eventId,
      },
    });

    // Create notifications for all participants
    const notifications = learningSession.participants.map((participant: any) => ({
      userId: participant.userId,
      title: 'Meeting Created',
      message: `A meeting has been created for the session "${learningSession.title}". Click to join.`,
      notificationType: 'MEETING_CREATED',
      relatedEntityType: 'SESSION',
      relatedEntityId: parsedSessionId,
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error creating meeting:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    );
  }
} 