import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get team messages
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    // Get and validate teamId first
    const teamId = params.teamId;
    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    console.log('Fetching messages for team:', teamId);
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      console.log('No session or user email found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('User email:', session.user.email);
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      console.log('User not found in database');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('Found user:', { id: user.id, email: user.email });
    
    // First check if the team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) {
      console.log('Team not found:', teamId);
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    console.log('Found team:', { id: team.id, name: team.name });

    // Check if user is a member of the team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: teamId,
        userId: user.id
      }
    });

    if (!teamMember) {
      console.log('User is not a member of the team');
      return NextResponse.json(
        { error: 'Not a team member' },
        { status: 403 }
      );
    }

    console.log('User is a team member:', { role: teamMember.role });

    // Get team messages
    const messages = await prisma.message.findMany({
      where: {
        teamId: teamId
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        sentAt: 'asc'
      },
      take: 50 // Limit to last 50 messages
    });

    console.log(`Found ${messages.length} messages`);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching team messages:', error);
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }

    // Check if it's a Prisma error
    if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      const prismaError = error as any;
      console.error('Prisma error details:', {
        code: prismaError.code,
        meta: prismaError.meta,
        message: prismaError.message
      });

      // Handle specific Prisma errors
      if (prismaError.code === 'P2023') {
        return NextResponse.json(
          { error: 'Invalid ID format' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch team messages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

interface TeamMember {
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

// Send a message to the team
export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    // Get and validate teamId first
    const teamId = params.teamId;
    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Validate team ID format
    if (!/^[a-zA-Z0-9-]+$/.test(teamId)) {
      return NextResponse.json(
        { error: 'Invalid team ID format' },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: teamId,
        userId: user.id
      }
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Not a team member' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (content.trim().length > 1000) {
      return NextResponse.json(
        { error: 'Message content too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    // Get team details and members
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    try {
      // Create the message
      const message = await prisma.message.create({
        data: {
          content: content.trim(),
          senderId: user.id,
          teamId: teamId
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Create notifications for all team members except the sender
      const notifications = team.members
        .filter((member: TeamMember) => member.userId !== user.id)
        .map((member: TeamMember) => ({
          userId: member.userId,
          title: 'New Team Message',
          message: `${user.name} sent a message in ${team.name}: "${content.length > 50 ? content.substring(0, 47) + '...' : content}"`,
          notificationType: 'TEAM_MESSAGE',
          relatedEntityType: 'TEAM',
          relatedEntityId: team.id,
        }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications
        });
      }

      return NextResponse.json(message);
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save message to database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending team message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 