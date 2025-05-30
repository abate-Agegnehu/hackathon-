import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const sessionId = parseInt(params.sessionId);
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Get session details
    const learningSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: {
            userId: user.id
          }
        }
      }
    });

    if (!learningSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if user is a participant
    if (learningSession.participants.length === 0) {
      return NextResponse.json(
        { error: 'You must be a session participant to request joining' },
        { status: 403 }
      );
    }

    // Check if session is in progress
    if (learningSession.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Session must be in progress to request joining' },
        { status: 400 }
      );
    }

    // Create notification for session creator
    await prisma.notification.create({
      data: {
        userId: learningSession.createdById,
        title: 'Meeting Join Request',
        message: `${user.name} has requested to join the meeting for session "${learningSession.title}"`,
        notificationType: 'MEET_JOIN_REQUEST',
        relatedEntityType: 'SESSION',
        relatedEntityId: sessionId.toString()
      }
    });

    // Create a meeting request record
    await prisma.meetingRequest.create({
      data: {
        sessionId,
        userId: user.id,
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Join request sent successfully'
    });
  } catch (error) {
    console.error('Error sending join request:', error);
    return NextResponse.json(
      { error: 'Failed to send join request' },
      { status: 500 }
    );
  }
} 