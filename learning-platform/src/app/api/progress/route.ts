import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';

interface SessionWithDuration {
  duration: number | null;
  title?: string;
}

interface SessionParticipantWithSession {
  id: number;
  userId: number;
  status: string;
  session: SessionWithDuration;
  updatedAt: Date;
}

interface BadgeWithName {
  id: number;
  badge: {
    name: string;
  };
  earnedAt: Date;
}

interface UserSkillWithName {
  skill: {
    name: string;
  };
  level: number;
  progress: number;
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

    // Get user's completed sessions
    const completedSessions = await prisma.session.count({
      where: {
        participants: {
          some: {
            userId: parseInt(session.user.id),
            status: 'COMPLETED',
          },
        },
      },
    });

    // Get total hours spent in sessions
    const sessionParticipations = await prisma.sessionParticipant.findMany({
      where: {
        userId: parseInt(session.user.id),
        status: 'COMPLETED',
      },
      include: {
        session: {
          select: {
            duration: true,
          },
        },
      },
    }) as SessionParticipantWithSession[];

    const totalHours = sessionParticipations.reduce(
      (acc: number, curr: SessionParticipantWithSession) => 
        acc + (curr.session.duration || 0),
      0
    ) / 60; // Convert minutes to hours

    // Get user's badges
    const earnedBadges = await prisma.userBadge.count({
      where: {
        userId: parseInt(session.user.id),
      },
    });

    // Calculate overall progress (based on completed sessions and challenges)
    const totalActivities = await prisma.session.count();
    const overallProgress = totalActivities > 0
      ? Math.round((completedSessions / totalActivities) * 100)
      : 0;

    // Get recent activities
    const recentActivities = await prisma.$transaction(async (tx: PrismaClient) => {
      // Get recent sessions
      const sessions = (await tx.sessionParticipant.findMany({
        where: {
          userId: parseInt(session.user.id),
        },
        include: {
          session: {
            select: {
              title: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 5,
      })) as unknown as SessionParticipantWithSession[];

      // Get recent badges
      const badges = (await tx.userBadge.findMany({
        where: {
          userId: parseInt(session.user.id),
        },
        include: {
          badge: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          earnedAt: 'desc',
        },
        take: 5,
      })) as unknown as BadgeWithName[];

      // Combine and format activities
      return [
        ...sessions.map((s) => ({
          id: `session_${s.id}`,
          type: 'SESSION' as const,
          title: s.session.title || 'Untitled Session',
          date: s.updatedAt.toISOString(),
          progress: s.status === 'COMPLETED' ? 100 : 
            s.status === 'IN_PROGRESS' ? 50 : 0,
        })),
        ...badges.map((b) => ({
          id: `badge_${b.id}`,
          type: 'BADGE' as const,
          title: `Earned ${b.badge.name} Badge`,
          date: b.earnedAt.toISOString(),
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // Get skill progress
    const skillProgress = await prisma.userSkill.findMany({
      where: {
        userId: parseInt(session.user.id),
      },
      select: {
        skill: {
          select: {
            name: true,
          },
        },
        level: true,
        progress: true,
      },
    }) as UserSkillWithName[];

    return NextResponse.json({
      totalHours: Math.round(totalHours * 10) / 10, // Round to 1 decimal place
      completedSessions,
      earnedBadges,
      overallProgress,
      recentActivities: recentActivities.slice(0, 10), // Limit to 10 most recent
      skillProgress: skillProgress.map((sp: UserSkillWithName) => ({
        name: sp.skill.name,
        level: sp.level,
        progress: sp.progress,
      })),
    });
  } catch (error) {
    console.error('Progress API Error:', error);
    
    // More detailed error handling
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Internal Server Error',
          message: error.message,
          // Don't expose stack trace in production
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 