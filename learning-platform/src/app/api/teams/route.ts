import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Team, TeamMember, Challenge } from '@prisma/client';

interface TeamWithRelations extends Team {
  members: {
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
    role: 'LEADER' | 'MEMBER';
  }[];
  challenges: {
    status: Challenge['status'];
  }[];
}

interface TeamResponse {
  id: string;
  name: string;
  description: string;
  status: Team['status'];
  maxMembers: number;
  members: {
    id: string;
    name: string | null;
    email: string | null;
    role: TeamMember['role'];
  }[];
  activeChallenges: number;
  completedChallenges: number;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        maxMembers: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            role: true,
          },
        },
        challenges: {
          where: {
            OR: [
              { status: 'ACTIVE' },
              { status: 'COMPLETED' },
            ],
          },
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedTeams: TeamResponse[] = teams.map((team: TeamWithRelations) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      status: team.status,
      maxMembers: team.maxMembers,
      members: team.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
      activeChallenges: team.challenges.filter((challenge) => challenge.status === 'ACTIVE').length,
      completedChallenges: team.challenges.filter((challenge) => challenge.status === 'COMPLETED').length,
    }));

    return NextResponse.json(formattedTeams);
  } catch (error) {
    console.error('Teams API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, maxMembers } = body;

    // Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    // Validate maxMembers
    if (maxMembers < 2 || maxMembers > 10) {
      return NextResponse.json(
        { error: 'Team size must be between 2 and 10 members' },
        { status: 400 }
      );
    }

    // Create new team
    const team = await prisma.team.create({
      data: {
        name,
        description,
        maxMembers,
        status: 'ACTIVE',
        members: {
          create: {
            userId: parseInt(session.user.id),
            role: 'LEADER',
          },
        },
      },
      include: {
        members: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            role: true,
          },
        },
      },
    });

    // Create notification for all users about the new team
    const allUsers = await prisma.user.findMany({
      where: {
        id: {
          not: parseInt(session.user.id) // Exclude the team creator
        }
      }
    });

    if (allUsers.length > 0) {
      await prisma.notification.createMany({
        data: allUsers.map((user: { id: number }) => ({
          userId: user.id,
          title: 'New Team Created',
          message: `${session.user.name || 'A user'} created a new team: "${name}"`,
          notificationType: 'TEAM_CREATED',
          relatedEntityType: 'TEAM',
          relatedEntityId: parseInt(team.id)
        }))
      });
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error('Create Team API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 