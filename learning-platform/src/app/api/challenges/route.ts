import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type ChallengeWithUserChallenges = Prisma.ChallengeGetPayload<{
  include: {
    userChallenges: true;
  };
}>;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log('Auth Session:', session);

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

    const challenges = await prisma.challenge.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        rewardPoints: 'asc'
      },
      select: {
        id: true,
        title: true,
        description: true,
        goalTarget: true,
        rewardPoints: true,
        isActive: true,
        userChallenges: {
          where: {
            userId: user.id
          },
          select: {
            progress: true,
            completed: true,
            completedAt: true
          }
        }
      }
    });

    // Format the response
    const formattedChallenges = challenges.map(challenge => ({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      goalTarget: challenge.goalTarget,
      rewardPoints: challenge.rewardPoints,
      isActive: challenge.isActive,
      progress: challenge.userChallenges[0]?.progress || 0,
      completed: challenge.userChallenges[0]?.completed || false,
      completedAt: challenge.userChallenges[0]?.completedAt || null
    }));

    return NextResponse.json(formattedChallenges);
  } catch (error) {
    console.error('Challenges API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenges', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('Auth Session:', session);

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

    const body = await request.json();
    console.log('Request body:', body);

    // Handle progress update
    if (body.challengeId !== undefined && body.progress !== undefined) {
      const challenge = await prisma.challenge.findUnique({
        where: { id: body.challengeId },
        include: {
          userChallenges: {
            where: { userId: user.id }
          }
        }
      });

      if (!challenge) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        );
      }

      const isNewlyCompleted = body.progress >= challenge.goalTarget && 
        (!challenge.userChallenges[0]?.completed);

      // Update or create user challenge progress
      const userChallenge = await prisma.userChallenge.upsert({
        where: {
          userId_challengeId: {
            userId: user.id,
            challengeId: body.challengeId
          }
        },
        update: {
          progress: body.progress,
          completed: body.progress >= challenge.goalTarget,
          completedAt: body.progress >= challenge.goalTarget ? new Date() : null
        },
        create: {
          userId: user.id,
          challengeId: body.challengeId,
          progress: body.progress,
          completed: body.progress >= challenge.goalTarget,
          completedAt: body.progress >= challenge.goalTarget ? new Date() : null
        }
      });

      // If challenge is newly completed, award a badge
      if (isNewlyCompleted) {
        // Create or get the challenge completion badge
        const badge = await prisma.badge.upsert({
          where: {
            name: 'Challenge Champion'
          },
          update: {},
          create: {
            name: 'Challenge Champion',
            description: 'Awarded for completing a learning challenge',
            imageUrl: '/badges/challenge-champion.png'
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
            title: 'Challenge Completed!',
            message: `Congratulations! You've completed the "${challenge.title}" challenge and earned a badge!`,
            notificationType: 'CHALLENGE_COMPLETE',
            relatedEntityType: 'CHALLENGE',
            relatedEntityId: challenge.id
          }
        });
      }

      return NextResponse.json({
        ...userChallenge,
        badgeAwarded: isNewlyCompleted
      });
    }

    // Handle challenge creation
    const { title, description, goalTarget, rewardPoints } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const newChallenge = await prisma.challenge.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        goalTarget: parseInt(goalTarget) || 1,
        rewardPoints: parseInt(rewardPoints) || 100,
        isActive: true
      }
    });

    return NextResponse.json(newChallenge);
  } catch (error) {
    console.error('Challenge API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process challenge request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 