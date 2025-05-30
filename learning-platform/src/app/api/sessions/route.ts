import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createGoogleMeet } from '@/lib/googleCalendar';

interface Session {
  id: number;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
  status: string;
  difficulty: string;
  participants: any[];
}

interface SessionResponse {
  id: number;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
  status: string;
  difficulty: string;
  currentParticipants: number;
}

export async function GET(request: Request) {
  try {
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

    // Get all sessions with participant info
    const sessions = await prisma.session.findMany({
      include: {
        participants: {
          select: {
            userId: true,
            status: true
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    // Transform sessions to include user-specific data
    const transformedSessions = sessions.map(session => {
      const isCreator = session.createdById === user.id;
      const hasJoined = session.participants.some(p => p.userId === user.id);
      
      return {
      id: session.id,
      title: session.title,
      description: session.description,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
      status: session.status,
      difficulty: session.difficulty,
        maxParticipants: session.maxParticipants,
        currentParticipants: session._count.participants,
        meetLink: session.meetLink,
        isCreator,
        hasJoined
      };
    });

    return NextResponse.json(transformedSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const session = await getServerSession(authOptions);
    console.log('Auth Session:', session);

    if (!session?.user?.email) {
      console.log('No user email found in session');
      return NextResponse.json(
        { error: 'Unauthorized - No user email' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('Request body:', body);

    const {
      title,
      description,
      startTime,
      duration,
      maxParticipants = 10,
      difficulty = 'INTERMEDIATE'
    } = body;

    // Basic validation
    if (!title || !description || !startTime || !duration) {
      console.log('Missing required fields:', { title, description, startTime, duration });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });
    console.log('Found user:', user);

    if (!user) {
      console.log('No user found for email:', session.user.email);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    // Create session without Google Meet first
    const newSession = await prisma.session.create({
      data: {
        title,
        description,
        startTime: startDateTime,
        endTime: endDateTime,
        maxParticipants,
        difficulty,
        createdById: user.id,
      },
    });

    // Add creator as participant
    await prisma.sessionParticipant.create({
      data: {
        sessionId: newSession.id,
        userId: user.id,
        role: 'HOST',
      },
    });

    // Try to create Google Meet
    let meetResult = null;
    try {
      meetResult = await createGoogleMeet(
        title,
        startDateTime,
        endDateTime,
        [user.email]
      );
    } catch (error) {
      console.error('Failed to create Google Meet:', error);
      // Continue without Google Meet
    }

    // Update session with Google Meet info if successful
    if (meetResult) {
      try {
        await prisma.session.update({
          where: { id: newSession.id },
          data: {
            meetLink: meetResult.meetLink,
            googleEventId: meetResult.eventId,
          },
        });
        newSession.meetLink = meetResult.meetLink;
        newSession.googleEventId = meetResult.eventId;
      } catch (error) {
        console.error('Failed to update session with Google Meet info:', error);
        // Continue without Google Meet info
      }
    }

    // Create notification for the session creator
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Session Created',
        message: `Your session "${title}" has been created successfully.`,
        notificationType: 'SESSION_CREATED',
        relatedEntityType: 'SESSION',
        relatedEntityId: newSession.id.toString()
      }
    });

    return NextResponse.json(newSession);
  } catch (error) {
    console.error('Create Session API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 