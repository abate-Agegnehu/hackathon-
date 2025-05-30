import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { challengeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { challengeId } = params;

    // Check if challenge exists and is available
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }

    if (challenge.status !== 'UPCOMING') {
      return NextResponse.json(
        { error: 'Challenge is not available for joining' },
        { status: 400 }
      );
    }

    if (challenge._count.participants >= challenge.maxParticipants) {
      return NextResponse.json(
        { error: 'Challenge is full' },
        { status: 400 }
      );
    }

    // Check if user is already a participant
    const existingParticipant = await prisma.challengeParticipant.findUnique({
      where: {
        userId_challengeId: {
          userId: session.user.id,
          challengeId,
        },
      },
    });

    if (existingParticipant) {
      return NextResponse.json(
        { error: 'Already joined this challenge' },
        { status: 400 }
      );
    }

    // Add user as participant
    await prisma.challengeParticipant.create({
      data: {
        userId: session.user.id,
        challengeId,
        progress: 0,
      },
    });

    // Create notification for challenge creator
    await prisma.notification.create({
      data: {
        userId: challenge.createdById,
        type: 'CHALLENGE_JOIN',
        title: 'New Challenge Participant',
        message: `${session.user.name} has joined your challenge "${challenge.title}"`,
      },
    });

    return NextResponse.json({ message: 'Successfully joined challenge' });
  } catch (error) {
    console.error('Join Challenge API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 