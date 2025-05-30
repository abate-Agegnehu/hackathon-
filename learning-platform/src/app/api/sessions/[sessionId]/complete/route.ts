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

    const sessionId = parseInt(params.sessionId);

    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Check if session exists
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
    if (learningSession.participants.length === 0 && learningSession.createdById !== user.id) {
      return NextResponse.json(
        { error: 'Not a participant of this session' },
        { status: 403 }
      );
    }

    // Update session and participant status
    await prisma.$transaction([
      // Update session status to completed
      prisma.session.update({
        where: { id: sessionId },
        data: { 
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      }),
      // Update participant status to completed
      prisma.sessionParticipant.updateMany({
        where: { 
          sessionId,
          userId: user.id
        },
        data: { 
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      })
    ]);

    // Check if this is the user's first completed session
    const completedSessionsCount = await prisma.sessionParticipant.count({
      where: {
        userId: user.id,
        status: 'COMPLETED'
      }
    });

    if (completedSessionsCount === 1) {
      // Award Quick Starter badge
      const badge = await prisma.badge.upsert({
        where: {
          name: 'Quick Starter'
        },
        update: {},
        create: {
          name: 'Quick Starter',
          description: 'Completed your first learning session',
          imageUrl: '/badges/quick-starter.png'
        }
      });

      // Award the badge to the user
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId: badge.id
        }
      });

      // Create a notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'BADGE_EARNED',
          title: 'Badge Earned!',
          message: 'Congratulations! You\'ve earned the Quick Starter badge for completing your first session!',
        },
      });
    }

    // Create notification for session creator if not the same user
    if (learningSession.createdById !== user.id) {
      await prisma.notification.create({
        data: {
          userId: learningSession.createdById,
          type: 'SESSION_COMPLETED',
          title: 'Session Completed',
          message: `${session.user.name || 'A participant'} has completed the session "${learningSession.title}"`,
        },
      });
    }

    return NextResponse.json({ message: 'Session marked as completed' });
  } catch (error) {
    console.error('Complete Session API Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 