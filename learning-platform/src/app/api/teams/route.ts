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
      console.log('Request body:', text); // Log raw request body
      body = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing request body:', e);
      return NextResponse.json(
        { error: 'Invalid request format. Please check your input.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      console.error('Invalid request body format:', body);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { name, description, maxMembers, isPremium, premiumFee } = body;
    console.log('Parsed request data:', { name, description, maxMembers, isPremium, premiumFee });

    // Validate required fields
    if (!name?.trim() || !description?.trim()) {
      console.error('Missing required fields:', { name, description });
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
      console.error('Invalid member count:', maxMembers);
      return NextResponse.json(
        { error: 'Team size must be between 2 and 10 members' },
        { status: 400 }
      );
    }

    // Validate premium settings
    if (isPremium) {
      const fee = Number(premiumFee);
      if (isNaN(fee) || fee <= 0) {
        console.error('Invalid premium fee:', premiumFee);
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
      console.error('User not found:', session.user.email);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('User subscriptions:', user.subscriptions);

    // Check subscription for premium team creation
    if (isPremium) {
      const hasValidSubscription = user.subscriptions.some(sub => 
        sub.isActive && sub.plan.canCreatePrivateTeams
      );

      if (!hasValidSubscription) {
        console.error('User lacks premium team creation permission:', {
          userId: user.id,
          subscriptions: user.subscriptions
        });
        return NextResponse.json(
          { error: 'Your subscription plan does not allow creating premium teams' },
          { status: 403 }
        );
      }
    }

    try {
      // Create the team
      const team = await prisma.team.create({
        data: {
          name: name.trim(),
          description: description.trim(),
          maxMembers: memberCount,
          isPremium,
          premiumFee: isPremium ? Number(premiumFee) : 0,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER'
            }
          }
        }
      });

      console.log('Created team:', team);

      // Note: Skipping activity log creation since team IDs are strings
      // and the activity log schema expects integer IDs

      // Revalidate teams page
      revalidatePath('/teams');

      return NextResponse.json(team);
    } catch (error) {
      console.error('Error creating team:', error);

      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return NextResponse.json(
            { error: 'A team with this name already exists' },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Failed to create team' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in team creation endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 