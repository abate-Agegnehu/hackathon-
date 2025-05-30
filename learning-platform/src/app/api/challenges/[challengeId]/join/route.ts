import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { challengeId: string } }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const challengeId = parseInt(params.challengeId, 10);
    const userId = parseInt(session.user.id, 10);

    if (isNaN(challengeId) || isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // Check if challenge exists and is available
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        _count: {
          select: {
            userChallenges: true,
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

    if (!challenge.isActive) {
      return NextResponse.json(
        { error: 'Challenge is not available for joining' },
        { status: 400 }
      );
    }

    if (challenge._count.userChallenges >= challenge.goalTarget) {
      return NextResponse.json(
        { error: 'Challenge is full' },
        { status: 400 }
      );
    }

    // Check if user is already a participant
    const existingParticipant = await prisma.userChallenge.findUnique({
      where: {
        userId_challengeId: {
          userId,
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
    await prisma.userChallenge.create({
      data: {
        userId,
        challengeId,
        progress: 0,
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