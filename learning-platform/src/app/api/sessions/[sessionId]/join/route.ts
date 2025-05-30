import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get and validate sessionId first
    const params = await context.params;
    const sessionId = params.sessionId;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const parsedSessionId = parseInt(sessionId);
    if (isNaN(parsedSessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Check if session exists and is available
    const learningSession = await prisma.session.findUnique({
      where: { id: parsedSessionId },
      include: {
        _count: {
          select: {
            participants: {
              where: {
                status: {
                  in: ['JOINED', 'IN_PROGRESS']
                }
              }
            }
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

    if (learningSession.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Session is not available for joining' },
        { status: 400 }
      );
    }

    if (learningSession._count.participants >= learningSession.maxParticipants) {
      return NextResponse.json(
        { error: 'Session is full' },
        { status: 400 }
      );
    }

    // Check if user is already a participant
    const existingParticipant = await prisma.sessionParticipant.findFirst({
      where: {
        AND: [
          { userId: user.id },
          { sessionId: parsedSessionId },
          { status: { in: ['JOINED', 'IN_PROGRESS'] } }  // Only consider active participants
        ]
      }
    });

    if (existingParticipant) {
      return NextResponse.json(
        { error: 'Already joined this session' },
        { status: 400 }
      );
    }

    // Cleanup any old completed or cancelled participations for this session
    await prisma.sessionParticipant.deleteMany({
      where: {
        AND: [
          { userId: user.id },
          { sessionId: parsedSessionId },
          { status: { in: ['COMPLETED', 'CANCELLED'] } }
        ]
      }
    });

    // Add user as participant
    await prisma.sessionParticipant.create({
      data: {
        userId: user.id,
        sessionId: parsedSessionId,
      },
    });

    // Create notification for session creator
    await prisma.notification.create({
      data: {
        userId: learningSession.createdById,
        type: 'SESSION_JOIN',
        title: 'New Session Participant',
        message: `${session.user.name || 'A user'} has joined your session "${learningSession.title}"`,
      },
    });

    return NextResponse.json({ message: 'Successfully joined session' });
  } catch (error) {
    console.error('Join Session API Error:', error);
    return NextResponse.json(
      { error: 'Failed to join session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 