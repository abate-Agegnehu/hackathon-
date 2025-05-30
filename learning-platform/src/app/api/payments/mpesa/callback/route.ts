import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Extract the necessary information from the callback
    const {
      Body: {
        stkCallback: {
          MerchantRequestID,
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata
        }
      }
    } = payload;

    // Find the payment record
    const payment = await prisma.teamPayment.findFirst({
      where: {
        status: 'PENDING'
      },
      include: {
        team: true,
        user: true
      }
    });

    if (!payment) {
      console.error('Payment record not found for checkout:', CheckoutRequestID);
      return NextResponse.json({ success: false });
    }

    if (ResultCode === 0) {
      // Payment successful
      const mpesaRef = CallbackMetadata.Item.find(
        (item: any) => item.Name === 'MpesaReceiptNumber'
      )?.Value;

      // Update payment record
      await prisma.teamPayment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          mpesaRef,
          completedAt: new Date()
        }
      });

      // Add user to team
      await prisma.teamMember.create({
        data: {
          teamId: payment.teamId,
          userId: payment.userId,
          role: 'MEMBER'
        }
      });

      // Create notification for successful payment
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          title: 'Team Payment Successful',
          message: `Your payment for joining ${payment.team.name} was successful.`,
          notificationType: 'PAYMENT',
          relatedEntityType: 'TEAM',
          relatedEntityId: parseInt(payment.teamId)
        }
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
          title: 'Team Payment Failed',
          message: `Your payment for joining ${payment.team.name} failed. Please try again.`,
          notificationType: 'PAYMENT',
          relatedEntityType: 'TEAM',
          relatedEntityId: parseInt(payment.teamId)
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing M-PESA callback:', error);
    return NextResponse.json(
      { error: 'Failed to process payment callback' },
      { status: 500 }
    );
  }
} 