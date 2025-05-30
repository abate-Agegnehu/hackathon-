import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createGoogleMeet } from '@/lib/googleCalendar';

const SESSION_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;

export async function POST(
  request: Request,
  context: { params: { sessionId: string } }
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
    const { sessionId } = context.params;
    const parsedSessionId = parseInt(sessionId);
    
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

    console.log('Session details:', {
      id: learningSession.id,
      status: learningSession.status,
      createdById: learningSession.createdById,
      userId: user.id
    });

    // Check if user is the creator
    if (learningSession.createdById !== user.id) {
      return NextResponse.json(
        { error: 'Only the session creator can start the session' },
        { status: 403 }
      );
    }

    // Check if session is in correct state
    if (learningSession.status !== SESSION_STATUS.SCHEDULED) {
      return NextResponse.json(
        { 
          error: `Session cannot be started - current status is ${learningSession.status}. Only sessions with status ${SESSION_STATUS.SCHEDULED} can be started.`,
          currentStatus: learningSession.status,
          requiredStatus: SESSION_STATUS.SCHEDULED
        },
        { status: 400 }
      );
    }

    // Check if the session's start time is valid
    const now = new Date();
    const sessionStartTime = new Date(learningSession.startTime);
    const thirtyMinutesBeforeStart = new Date(sessionStartTime.getTime() - 30 * 60000);
    
    if (now < thirtyMinutesBeforeStart) {
      return NextResponse.json(
        { 
          error: 'Session cannot be started yet - too early. Sessions can be started up to 30 minutes before the scheduled start time.',
          startTime: sessionStartTime,
          earliestStartTime: thirtyMinutesBeforeStart,
          currentTime: now
        },
        { status: 400 }
      );
    }

    let meetLink: string | undefined;
    let googleEventId: string | undefined;

    try {
      // Create Google Meet
      const attendeeEmails = learningSession.participants.map((p: any) => p.user.email);
      const meetResult = await createGoogleMeet(
        learningSession.title,
        learningSession.startTime,
        learningSession.endTime,
        attendeeEmails
      );

      if (meetResult) {
        meetLink = meetResult.meetLink;
        googleEventId = meetResult.eventId;
      }
    } catch (error) {
      console.error('Error creating Google Meet:', error);
      // Continue without Google Meet if creation fails
    }

    // Update session status and meet info
    const updateData: any = {
      status: SESSION_STATUS.IN_PROGRESS,
    };

    if (meetLink && googleEventId) {
      updateData.meetLink = meetLink;
      updateData.googleEventId = googleEventId;
    }

    const updatedSession = await prisma.session.update({
      where: { id: parsedSessionId },
      data: updateData,
    });

    // Create notifications for all participants
    await prisma.notification.createMany({
      data: learningSession.participants.map((participant) => ({
        userId: participant.userId,
        title: 'Session Started',
        message: `The session "${learningSession.title}" has started.${meetLink ? ' Click to join the meeting.' : ''}`,
        notificationType: 'SESSION_STARTED',
        relatedEntityType: 'SESSION',
        relatedEntityId: parsedSessionId.toString()
      }))
    });

    return NextResponse.json({
      success: true,
      message: 'Session started successfully',
      meetLink: updatedSession.meetLink
    });
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
} 