import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
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

    const { teamId } = params;

    // Check if team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check if team is full
    if (team._count.members >= team.maxMembers) {
      return NextResponse.json(
        { error: 'Team is full' },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        AND: [
          { userId: user.id },
          { teamId }
        ]
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'Already a member of this team' },
        { status: 400 }
      );
    }

    // Add user as team member
    await prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId,
        role: 'MEMBER',
      },
    });

    // Check if this is the user's first team
    const teamCount = await prisma.teamMember.count({
      where: {
        userId: user.id
      }
    });

    if (teamCount === 1) {
      // Award Team Player badge
      const badge = await prisma.badge.upsert({
        where: {
          name: 'Team Player'
        },
        update: {},
        create: {
          name: 'Team Player',
          description: 'Joined your first team',
          imageUrl: '/badges/team-player.png'
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
          message: 'Congratulations! You\'ve earned the Team Player badge for joining your first team!',
        },
      });
    }

    // Get team leader to send notification
    const teamLeader = await prisma.teamMember.findFirst({
      where: {
        teamId,
        role: 'LEADER',
      },
      select: {
        userId: true,
      },
    });

    if (teamLeader) {
      // Create notification for team leader
      await prisma.notification.create({
        data: {
          userId: teamLeader.userId,
          title: 'New Team Member',
          message: `${session.user.name || 'A user'} has joined your team "${team.name}"`,
          notificationType: 'TEAM_JOIN',
          relatedEntityType: 'TEAM',
          relatedEntityId: parseInt(teamId),
        },
      });
    }

    return NextResponse.json({ message: 'Successfully joined team' });
  } catch (error) {
    console.error('Join Team API Error:', error);
    return NextResponse.json(
      { error: 'Failed to join team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 