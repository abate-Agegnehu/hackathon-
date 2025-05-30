import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('M-PESA webhook payload:', payload);

    // Extract payment details from the payload
    const {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      MpesaReceiptNumber,
      PhoneNumber,
    } = payload;

    // Find the payment record
    const payment = await prisma.teamPayment.findFirst({
      where: {
        checkoutRequestId: CheckoutRequestID
      },
      include: {
        team: true
      }
    });

    if (!payment) {
      console.error('Payment not found for checkout request:', CheckoutRequestID);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Check if this is a subscription payment
    if (payment.team.name.startsWith('Subscription_')) {
      if (ResultCode === 0) { // Payment successful
        // Update payment status
        await prisma.teamPayment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            mpesaRef: MpesaReceiptNumber,
            completedAt: new Date()
          }
        });

        // Extract plan ID from team name
        const planId = parseInt(payment.team.description.split('plan')[0].trim());
        
        // Get user's current subscriptions
        const user = await prisma.user.findUnique({
          where: { id: payment.userId },
          include: {
            subscriptions: {
              where: { isActive: true }
            }
          }
        });

        if (!user) {
          console.error('User not found:', payment.userId);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Deactivate current subscriptions
        if (user.subscriptions.length > 0) {
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
            planId: planId,
            startDate,
            endDate,
            isActive: true,
            billingCycle: 'MONTHLY',
            paymentMethod: 'MPESA'
          }
        });

        // Create notification for successful payment
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: 'Subscription Activated',
            message: 'Your subscription has been activated after successful payment.',
            notificationType: 'SUBSCRIPTION',
            relatedEntityType: 'SUBSCRIPTION',
            relatedEntityId: subscription.id.toString()
          }
        });

        // Delete the temporary team
        await prisma.team.delete({
          where: { id: payment.teamId }
        });

        return NextResponse.json({
          success: true,
          message: 'Subscription activated successfully'
        });
      } else {
        // Payment failed
        await prisma.teamPayment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            completedAt: new Date()
          }
        });

        // Create notification for failed payment
        await prisma.notification.create({
          data: {
            userId: payment.userId,
            title: 'Payment Failed',
            message: `Subscription payment failed: ${ResultDesc}`,
            notificationType: 'PAYMENT',
            relatedEntityType: 'PAYMENT',
            relatedEntityId: payment.id.toString()
          }
        });

        return NextResponse.json({
          success: false,
          message: 'Payment failed'
        });
      }
    }

    // Handle regular team payments here...
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing M-PESA webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 