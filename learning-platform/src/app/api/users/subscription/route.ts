import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with active subscription
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscriptions: {
          where: { isActive: true },
          include: { plan: true },
          orderBy: { startDate: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the active subscription if any
    const activeSubscription = user.subscriptions[0];

    return NextResponse.json({
      isActive: !!activeSubscription,
      plan: activeSubscription?.plan || null,
      subscriptionId: activeSubscription?.id || null,
      expiresAt: activeSubscription?.endDate || null
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
} 