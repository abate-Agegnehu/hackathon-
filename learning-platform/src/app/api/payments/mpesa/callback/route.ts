import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mpesa } from '@/lib/mpesa';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    console.log('Received M-PESA callback:', {
      ...payload,
      // Mask any sensitive data
      Body: {
        ...payload.Body,
        stkCallback: {
          ...payload.Body?.stkCallback,
          CallbackMetadata: '***'
        }
      }
    });
    
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
        checkoutRequestId: CheckoutRequestID,
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
      // Extract payment details from callback metadata
      const getMetadataValue = (name: string) => {
        const item = CallbackMetadata?.Item?.find((i: any) => i.Name === name);
        return item ? item.Value : null;
      };

      const mpesaRef = getMetadataValue('MpesaReceiptNumber');
      const transactionAmount = getMetadataValue('Amount');
      const transactionDate = getMetadataValue('TransactionDate');
      const phoneNumber = getMetadataValue('PhoneNumber');

      // Validate the payment amount matches what was expected
      if (transactionAmount !== payment.amount) {
        console.error('Payment amount mismatch:', {
          expected: payment.amount,
          received: transactionAmount,
          paymentId: payment.id
        });
      }

      // Update payment record
      await prisma.teamPayment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          mpesaRef,
          completedAt: new Date(),
          // Store additional metadata
          metadata: {
            transactionDate: transactionDate?.toString(),
            confirmedPhoneNumber: phoneNumber?.toString()
          }
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

      // Create success notification
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          title: 'Team Payment Successful',
          message: `Your payment of ${payment.amount} KES for joining ${payment.team.name} was successful. Transaction ID: ${mpesaRef}`,
          notificationType: 'PAYMENT',
          relatedEntityType: 'TEAM',
          relatedEntityId: payment.teamId
        }
      });
    } else {
      // Payment failed
      const errorMessage = ResultDesc || 'Payment failed';
      
      await prisma.teamPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          metadata: {
            errorCode: ResultCode.toString(),
            errorMessage
          }
        }
      });

      // Create failure notification
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          title: 'Team Payment Failed',
          message: `Your payment for joining ${payment.team.name} failed: ${errorMessage}. Please try again.`,
          notificationType: 'PAYMENT',
          relatedEntityType: 'TEAM',
          relatedEntityId: payment.teamId
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