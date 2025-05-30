import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(
  request: Request,
  context: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get and validate teamId from params
    const params = await context.params;
    if (!params?.teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    const teamId = params.teamId;
    const userId = parseInt(session.user.id);

    // Check if the team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { role: 'LEADER' },
          select: { userId: true }
        }
      }
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check if the user is a member of the team
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: teamId,
          userId: userId
        }
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 400 }
      );
    }

    // Check if the user is the team leader
    if (membership.role === 'LEADER') {
      // Count other members
      const memberCount = await prisma.teamMember.count({
        where: { teamId: teamId }
      });

      if (memberCount > 1) {
        return NextResponse.json(
          { error: 'Team leaders cannot leave while other members are in the team. Transfer leadership first.' },
          { status: 400 }
        );
      }

      // If the leader is the last member, delete the team
      await prisma.team.delete({
        where: { id: teamId }
      });

      return NextResponse.json({
        message: 'Team has been deleted as you were the last member'
      });
    }

    // Remove the member from the team
    await prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId: teamId,
          userId: userId
        }
      }
    });

    // Create notification for team members about the user leaving
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: teamId,
        userId: { not: userId }
      },
      select: { userId: true }
    });

    if (teamMembers.length > 0) {
      await prisma.notification.createMany({
        data: teamMembers.map((member: { userId: number }) => ({
          userId: member.userId,
          title: 'Team Member Left',
          message: `${session.user.name || 'A member'} has left the team "${team.name}"`,
          notificationType: 'TEAM_MEMBER_LEFT',
          relatedEntityType: 'TEAM',
          relatedEntityId: null
        }))
      });
    }

    // After all operations are complete, revalidate the pages
    revalidatePath('/teams');
    revalidatePath(`/teams/${teamId}`);

    return NextResponse.json({
      message: 'Successfully left the team',
      revalidated: true
    });
  } catch (error) {
    console.error('Leave Team API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 