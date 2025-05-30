import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mpesa } from '@/lib/mpesa';
import { revalidatePath } from 'next/cache';

export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const teamId = params.teamId;
    const body = await request.json();
    const phoneNumber = body.phoneNumber;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Get user
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

    // Get team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true
      }
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMember = team.members.find(member => member.userId === user.id);
    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already a member of this team' },
        { status: 400 }
      );
    }

    // Check team capacity
    if (team.members.length >= team.maxMembers) {
      return NextResponse.json(
        { error: 'Team is full' },
        { status: 400 }
      );
    }

    // If team is premium, check user's subscription
    if (team.isPremium) {
      const hasValidSubscription = user.subscriptions.some(sub => 
        sub.plan.canCreatePrivateTeams && sub.isActive
      );

      if (!hasValidSubscription) {
        try {
          // Create a payment record
          const payment = await prisma.teamPayment.create({
            data: {
              teamId,
              userId: user.id,
              amount: team.premiumFee,
              phoneNumber
            }
          });

          // Initiate M-PESA payment
          const mpesaResponse = await mpesa.initiateSTKPush(
            phoneNumber,
            Number(team.premiumFee),
            `Team-${teamId}`,
            `Premium Team Membership`
          );

          return NextResponse.json({
            requiresPayment: true,
            paymentId: payment.id,
            checkoutRequestId: mpesaResponse.CheckoutRequestID
          });
        } catch (error) {
          console.error('M-PESA payment initiation failed:', error);
          return NextResponse.json(
            { error: 'Payment initiation failed. Please try again.' },
            { status: 500 }
          );
        }
      }
    }

    // Add user to team
    const teamMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId: user.id,
        role: 'MEMBER'
      }
    });

    // Check if this is the user's first team
    const teamCount = await prisma.teamMember.count({
      where: {
        userId: user.id
      }
    });

    if (teamCount === 1) {
      // Award Team Player badge
      const badge = await prisma.badge.upsert({
        where: {
          name: 'Team Player'
        },
        update: {},
        create: {
          name: 'Team Player',
          description: 'Joined your first team',
          imageUrl: '/badges/team-player.png'
        }
      });

      // Award the badge to the user
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId: badge.id
        }
      });

      // Create a notification for the badge
      await prisma.notification.create({
        data: {
          userId: user.id,
          notificationType: 'BADGE_EARNED',
          title: 'Badge Earned!',
          message: 'Congratulations! You\'ve earned the Team Player badge for joining your first team!',
        },
      });
    }

    // Create notification for team members
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        userId: {
          not: user.id
        }
      }
    });

    for (const member of teamMembers) {
      await prisma.notification.create({
        data: {
          userId: member.userId,
          notificationType: 'TEAM_JOIN',
          title: 'New Team Member',
          message: `${session.user.name || 'A new member'} has joined your team "${team.name}"`,
        },
      });
    }

    // Revalidate the teams page to force an update
    revalidatePath('/teams');
    revalidatePath(`/teams/${teamId}`);

    return NextResponse.json(teamMember);
  } catch (error) {
    console.error('Error joining team:', error);
    return NextResponse.json(
      { error: 'Failed to join team. Please try again.' },
      { status: 500 }
    );
  }
} 