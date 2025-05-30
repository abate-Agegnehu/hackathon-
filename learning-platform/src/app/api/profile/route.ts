import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the user ID as an integer
    const userId = parseInt(session.user.id as string);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            sessionParticipants: {
              where: {
                status: 'COMPLETED'
              }
            },
            badges: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get recent badges
    const recentBadges = await prisma.badge.findMany({
      where: {
        userBadges: {
          some: {
            userId: userId,
          },
        },
      },
      orderBy: {
        userBadges: {
          _count: 'desc',
        },
      },
      take: 6,
      select: {
        id: true,
        name: true,
        description: true,
        userBadges: {
          where: {
            userId: userId,
          },
          select: {
            earnedAt: true,
          },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      completedSessions: user._count.sessionParticipants,
      earnedBadges: user._count.badges,
      joinedDate: user.createdAt,
      recentBadges: recentBadges.map((badge: { 
        id: number; 
        name: string; 
        description: string | null; 
        userBadges: Array<{ earnedAt: Date }>;
      }) => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        earnedAt: badge.userBadges[0]?.earnedAt,
      })),
    });
  } catch (error) {
    console.error('Profile API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find user by email first
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
    const { name, bio } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        bio: bio || null,
      },
      select: {
        name: true,
        bio: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Update Profile API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 