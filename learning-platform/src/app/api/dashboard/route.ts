import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface DashboardSession {
  id: number;
  title: string;
  startTime: Date;
}

interface DashboardAchievement {
  id: number;
  title: string;
  date: Date | null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log('Auth Session:', session);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let totalSessions = 0;
    let completedSessions = 0;
    let earnedBadges = 0;
    let upcomingSessions: DashboardSession[] = [];
    let recentChallenges: DashboardAchievement[] = [];
    let activeTeams = 0;

    try {
      // Total sessions (created or participated)
      const [totalSessionsResult] = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT s.id) as count
        FROM sessions s
        LEFT JOIN session_participants sp ON s.id = sp.sessionId
        WHERE s.createdById = ${user.id} OR sp.userId = ${user.id}
      ` as { count: number }[];
      totalSessions = Number(totalSessionsResult.count);

      // Completed sessions
      const [completedSessionsResult] = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT s.id) as count
        FROM sessions s
        LEFT JOIN session_participants sp ON s.id = sp.sessionId
        WHERE (s.createdById = ${user.id} OR sp.userId = ${user.id})
        AND s.status = 'COMPLETED'
      ` as { count: number }[];
      completedSessions = Number(completedSessionsResult.count);

      // Upcoming sessions
      upcomingSessions = await prisma.$queryRaw`
        SELECT DISTINCT s.id, s.title, s.startTime
        FROM sessions s
        LEFT JOIN session_participants sp ON s.id = sp.sessionId
        WHERE (s.createdById = ${user.id} OR sp.userId = ${user.id})
        AND s.startTime >= NOW()
        AND s.status = 'SCHEDULED'
        ORDER BY s.startTime ASC
        LIMIT 5
      ` as DashboardSession[];

      // Active teams (in-progress sessions)
      const [activeTeamsResult] = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT s.id) as count
        FROM sessions s
        JOIN session_participants sp ON s.id = sp.sessionId
        WHERE sp.userId = ${user.id}
        AND sp.status = 'JOINED'
        AND s.status = 'IN_PROGRESS'
      ` as { count: number }[];
      activeTeams = Number(activeTeamsResult.count);
    } catch (dbError) {
      console.error('Error querying sessions:', dbError);
    }

    try {
      // Earned badges (completed challenges)
      const [earnedBadgesResult] = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM user_challenges
        WHERE userId = ${user.id} AND completed = true
      ` as { count: number }[];
      earnedBadges = Number(earnedBadgesResult.count);

      // Recent challenges
      recentChallenges = await prisma.$queryRaw`
        SELECT 
          uc.id,
          c.title,
          uc.completedAt as date
        FROM user_challenges uc
        JOIN challenges c ON uc.challengeId = c.id
        WHERE uc.userId = ${user.id}
        AND uc.completed = true
        AND uc.completedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY uc.completedAt DESC
        LIMIT 5
      ` as DashboardAchievement[];
    } catch (dbError) {
      console.error('Error querying challenges:', dbError);
      // Challenges tables don't exist yet, that's okay
    }

    // Calculate progress
    const progress = totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0;

    return NextResponse.json({
      totalSessions,
      completedSessions,
      activeTeams,
      earnedBadges,
      progress,
      upcomingSessions,
      recentAchievements: recentChallenges,
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 