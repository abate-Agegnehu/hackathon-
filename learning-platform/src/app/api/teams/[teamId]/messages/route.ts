import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get team messages
export async function GET(
  request: Request,
  context: { params: { teamId: string } }
) {
  try {
    // Get and validate teamId first
    const params = await context.params;
    const teamId = params.teamId;
    console.log('Fetching messages for team:', teamId);

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Get messages for the team
    const messages = await prisma.message.findMany({
      where: {
        teamId: teamId
      },
      include: {
        sender: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching team messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team messages' },
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
  context: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get and validate teamId
    const params = await context.params;
    const teamId = params.teamId;

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Find the user
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
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: teamId,
          userId: user.id
        }
      }
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'You must be a team member to send messages' },
        { status: 403 }
      );
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content,
        teamId,
        senderId: user.id
      },
      include: {
        sender: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Create notifications for other team members
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: teamId,
        userId: { not: user.id } // Exclude the message sender
      },
      select: { userId: true }
    });

    if (teamMembers.length > 0) {
      await prisma.notification.createMany({
        data: teamMembers.map((member: { userId: number }) => ({
          userId: member.userId,
          title: 'New Team Message',
          message: `${user.name || 'A team member'} sent a message in the team chat`,
          notificationType: 'TEAM_MESSAGE',
          relatedEntityType: 'TEAM',
          relatedEntityId: null
        }))
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error creating team message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
} 