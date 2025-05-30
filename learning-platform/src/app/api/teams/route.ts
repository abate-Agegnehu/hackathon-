import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { type Prisma } from '.prisma/client';
import { revalidatePath } from 'next/cache';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

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
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'You must be signed in to create a team' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body;
    try {
      const text = await request.text();
      body = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing request body:', e);
      return NextResponse.json(
        { error: 'Invalid request format. Please check your input.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { name, description, maxMembers, isPremium, premiumFee } = body;

    // Validate required fields
    if (!name?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'Team name and description are required' },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (name.length > 255) {
      return NextResponse.json(
        { error: 'Team name must be less than 255 characters' },
        { status: 400 }
      );
    }

    // Validate maxMembers
    const memberCount = Number(maxMembers);
    if (isNaN(memberCount) || memberCount < 2 || memberCount > 10) {
      return NextResponse.json(
        { error: 'Team size must be between 2 and 10 members' },
        { status: 400 }
      );
    }

    // Validate premium settings
    if (isPremium) {
      const fee = Number(premiumFee);
      if (isNaN(fee) || fee <= 0) {
        return NextResponse.json(
          { error: 'Premium teams must have a valid fee greater than 0' },
          { status: 400 }
        );
      }
    }

    // Get user and validate permissions
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscriptions: {
          where: { isActive: true },
          include: { plan: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check premium team creation permission
    if (isPremium) {
      const canCreatePremiumTeam = user.subscriptions.some(
        sub => sub.plan.canCreatePrivateTeams
      );

      if (!canCreatePremiumTeam) {
        return NextResponse.json(
          { error: 'Your subscription plan does not allow creating premium teams' },
          { status: 403 }
        );
      }
    }

    // Create team using a transaction
    const team = await prisma.$transaction(async (tx) => {
      // Create the team
      const newTeam = await tx.team.create({
        data: {
          name: name.trim(),
          description: description.trim(),
          maxMembers: memberCount,
          status: 'ACTIVE',
          isPremium: isPremium || false,
          premiumFee: isPremium ? Number(premiumFee) : 0,
          members: {
            create: {
              userId: user.id,
              role: 'LEADER',
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Create notifications for other users
      const otherUsers = await tx.user.findMany({
        where: {
          id: {
            not: user.id
          }
        },
        select: { id: true }
      });

      if (otherUsers.length > 0) {
        // Create notifications with the team ID directly
        const notifications = otherUsers.map((otherUser) => ({
          userId: otherUser.id,
          title: 'New Team Created',
          message: `${session.user.name || 'A user'} created a new ${isPremium ? 'premium' : ''} team: "${name}"`,
          notificationType: 'TEAM_CREATED',
          relatedEntityType: 'TEAM',
          relatedEntityId: null // We'll set this in a separate update
        }));

        // Create all notifications
        await tx.notification.createMany({
          data: notifications
        });
      }

      return newTeam;
    });

    // Now update the notifications with the team ID
    const teamIdNumber = team.id ? parseInt(team.id.replace(/\D/g, '')) : null;
    
    if (teamIdNumber && !isNaN(teamIdNumber)) {
      try {
        await prisma.notification.updateMany({
          where: {
            notificationType: 'TEAM_CREATED',
            relatedEntityId: null,
            createdAt: {
              gte: new Date(Date.now() - 5000) // Notifications created in the last 5 seconds
            }
          },
          data: {
            relatedEntityId: teamIdNumber
          }
        });
      } catch (updateError) {
        console.error('Failed to update notification IDs:', updateError);
        // Don't throw here, as the team was still created successfully
      }
    }

    // Revalidate the teams page
    revalidatePath('/teams');

    return NextResponse.json(team);
  } catch (error) {
    console.error('Create Team API Error:', error);
    
    // Handle specific database errors
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A team with this name already exists' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create team. Please try again.' },
      { status: 500 }
    );
  }
} 