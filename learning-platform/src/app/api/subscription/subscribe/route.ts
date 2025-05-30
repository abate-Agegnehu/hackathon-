import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    let body;
    try {
      const text = await request.text();
      console.log('Request body:', text);
      body = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing request body:', e);
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { planId, paymentMethod, phoneNumber } = body;
    console.log('Plan ID:', planId);

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required for payment' },
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
      console.error('User not found:', session.user.email);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the selected plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      console.error('Invalid plan ID:', planId);
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
        { status: 400 }
      );
    }

    // Skip payment for free (Basic) plan
    if (plan.priceMonthly > 0) {
      // Create a payment record
      const payment = await prisma.subscriptionPayment.create({
        data: {
          userId: user.id,
          planId: plan.id,
          amount: plan.priceMonthly,
          currency: 'KES',
          status: 'PENDING',
          phoneNumber: phoneNumber,
          paymentMethod: paymentMethod || 'MPESA'
        }
      });

      // Return payment details for the frontend to handle
      return NextResponse.json({
        success: true,
        requiresPayment: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status
        },
        message: 'Please complete the payment to activate your subscription'
      });
    }

    // For free plan, proceed with subscription creation
    // Deactivate current subscription if exists
    if (user.subscriptions.length > 0) {
      console.log('Deactivating current subscriptions');
      await prisma.userSubscription.updateMany({
        where: {
          userId: user.id,
          isActive: true
        },
        data: {
          isActive: false,
          endDate: new Date()
        }
      });
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    // Create new subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        startDate,
        endDate,
        isActive: true,
        billingCycle: 'MONTHLY',
        paymentMethod: 'FREE'
      },
      include: {
        plan: true
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Subscription Updated',
        message: `You have successfully subscribed to the ${plan.name} plan.`,
        notificationType: 'SUBSCRIPTION',
        relatedEntityType: 'SUBSCRIPTION',
        relatedEntityId: subscription.id
      }
    });

    return NextResponse.json({
      success: true,
      requiresPayment: false,
      subscription
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
} 