import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id, 10);

    // Get recent activities
    const recentActivities = await prisma.$transaction(async (tx) => {
      // Get recent sessions
      const sessions = await tx.sessionParticipant.findMany({
        where: {
          userId,
          status: 'COMPLETED'
        },
        include: {
          session: {
            select: {
              id: true,
              title: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 5
      });

      const formattedSessions = sessions.map(participant => ({
        id: participant.session.id.toString(),
        type: 'SESSION',
        title: participant.session.title,
        date: participant.updatedAt.toISOString(),
        progress: 100 // Since status is COMPLETED
      }));

      // Get recent badges
      const badges = await tx.userBadge.findMany({
        where: {
          userId
        },
        include: {
          badge: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          earnedAt: 'desc'
        },
        take: 5
      });

      const formattedBadges = badges.map(userBadge => ({
        id: userBadge.badge.id.toString(),
        type: 'BADGE',
        title: userBadge.badge.name,
        date: userBadge.earnedAt.toISOString()
      }));

      return [...formattedSessions, ...formattedBadges]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
    });

    // Get skill levels
    const skills = await prisma.userSkill.findMany({
      where: {
        userId
      },
      include: {
        skill: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        level: 'desc'
      },
      take: 5
    });

    const skillProgress = skills.map(us => ({
      name: us.skill.name,
      level: us.level,
      progress: us.progress || 0
    }));

    // Calculate overall stats
    const completedSessions = await prisma.sessionParticipant.count({
      where: {
        userId,
        status: 'COMPLETED'
      }
    });

    const earnedBadges = await prisma.userBadge.count({
      where: {
        userId
      }
    });

    // Calculate total hours (assuming each session is 1 hour for simplicity)
    const totalHours = completedSessions;

    // Calculate overall progress (based on average skill progress)
    const overallProgress = skillProgress.length > 0
      ? Math.round(skillProgress.reduce((acc, curr) => acc + curr.progress, 0) / skillProgress.length)
      : 0;

    return NextResponse.json({
      totalHours,
      completedSessions,
      earnedBadges,
      overallProgress,
      recentActivities,
      skillProgress
    });
  } catch (error) {
    console.error('Progress API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 