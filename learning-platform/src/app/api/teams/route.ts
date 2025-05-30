import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { type Prisma } from '.prisma/client';

type TeamWithRelations = Prisma.TeamGetPayload<{
  include: {
    members: {
      include: {
        user: {
          select: {
            id: true;
            name: true;
            email: true;
          };
        };
      };
    };
    challenges: {
      select: {
        status: true;
      };
    };
  };
}>;

interface TeamResponse {
  id: string;
  name: string;
  description: string;
  status: string;
  maxMembers: number;
  members: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
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

    const formattedTeams: TeamResponse[] = teams.map((team: any) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      status: team.status,
      maxMembers: team.maxMembers,
      members: team.members.map((member: any) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
      activeChallenges: team.challenges.filter((challenge: any) => challenge.status === 'ACTIVE').length,
      completedChallenges: team.challenges.filter((challenge: any) => challenge.status === 'COMPLETED').length,
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
    const { name, description, maxMembers, isPremium, premiumFee } = body;

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

    // Validate premium settings
    if (isPremium && (!premiumFee || premiumFee <= 0)) {
      return NextResponse.json(
        { error: 'Premium teams must have a valid fee greater than 0' },
        { status: 400 }
      );
    }

    // Check if user has permission to create premium teams
    if (isPremium) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
          subscriptions: {
            where: { isActive: true },
            include: { plan: true }
          }
        }
      });

      const canCreatePremiumTeam = user?.subscriptions.some(
        sub => sub.plan.canCreatePrivateTeams
      );

      if (!canCreatePremiumTeam) {
        return NextResponse.json(
          { error: 'Your subscription plan does not allow creating premium teams' },
          { status: 403 }
        );
      }
    }

    // Create new team
    const team = await prisma.team.create({
      data: {
        name,
        description,
        maxMembers,
        status: 'ACTIVE',
        isPremium: isPremium || false,
        premiumFee: isPremium ? premiumFee : 0,
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
          message: `${session.user.name || 'A user'} created a new ${isPremium ? 'premium' : ''} team: "${name}"`,
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
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
} 