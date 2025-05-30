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

    // Validate phone number format (should be in the format 254XXXXXXXXX)
    if (!phoneNumber || !/^254\d{9}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please use format: 254XXXXXXXXX' },
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
          // Validate M-PESA configuration
          if (!process.env.MPESA_CONSUMER_KEY || 
              !process.env.MPESA_CONSUMER_SECRET || 
              !process.env.MPESA_PASSKEY || 
              !process.env.MPESA_SHORTCODE) {
            console.error('Missing M-PESA configuration:', {
              hasConsumerKey: !!process.env.MPESA_CONSUMER_KEY,
              hasConsumerSecret: !!process.env.MPESA_CONSUMER_SECRET,
              hasPasskey: !!process.env.MPESA_PASSKEY,
              hasShortcode: !!process.env.MPESA_SHORTCODE
            });
            throw new Error('M-PESA configuration is incomplete');
          }

          // Create a payment record first
          const payment = await prisma.teamPayment.create({
            data: {
              teamId,
              userId: user.id,
              amount: team.premiumFee,
              phoneNumber,
              status: 'PENDING'
            }
          });

          try {
            // Validate amount
            const amount = Number(team.premiumFee);
            if (isNaN(amount) || amount < 1) {
              return NextResponse.json(
                { error: 'Invalid premium fee amount. Must be at least 1 KES.' },
                { status: 400 }
              );
            }

            console.log('Initiating M-PESA payment with:', {
              phoneNumber,
              amount,
              teamId,
              userId: user.id
            });

            // Initiate M-PESA payment with rounded amount
            const mpesaResponse = await mpesa.initiateSTKPush(
              phoneNumber,
              Math.ceil(amount), // Round up to ensure whole number
              "CompanyXLTD", // Use the same reference as the test
              "Payment of X" // Use the same description as the test
            );

            console.log('M-PESA response:', mpesaResponse);

            if (!mpesaResponse?.CheckoutRequestID) {
              throw new Error('Invalid M-PESA response: Missing CheckoutRequestID');
            }

            // Update payment record with checkout request ID
            await prisma.teamPayment.update({
              where: { id: payment.id },
              data: {
                status: 'PENDING',
                // @ts-ignore - The field exists in the database but TypeScript doesn't know about it yet
                checkoutRequestId: mpesaResponse.CheckoutRequestID
              }
            });

            return NextResponse.json({
              requiresPayment: true,
              paymentId: payment.id,
              checkoutRequestId: mpesaResponse.CheckoutRequestID,
              message: 'Please complete the payment on your phone'
            });
          } catch (mpesaError) {
            console.error('M-PESA payment initiation error:', {
              error: mpesaError,
              message: mpesaError instanceof Error ? mpesaError.message : 'Unknown error',
              paymentId: payment.id
            });

            // If M-PESA request fails, update payment status and throw error
            await prisma.teamPayment.update({
              where: { id: payment.id },
              data: { status: 'FAILED' }
            });

            throw new Error(
              mpesaError instanceof Error 
                ? `Failed to initiate M-PESA payment: ${mpesaError.message}` 
                : 'Failed to initiate M-PESA payment. Please try again.'
            );
          }
        } catch (error) {
          console.error('Payment initiation failed:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            teamId,
            userId: user.id
          });
          return NextResponse.json(
            { 
              error: error instanceof Error ? error.message : 'Payment initiation failed. Please try again.',
              details: process.env.NODE_ENV === 'development' ? error : undefined
            },
            { status: 500 }
          );
        }
      }
    }

    // Add user to team if no payment required or has valid subscription
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