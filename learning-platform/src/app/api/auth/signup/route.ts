import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // Log the raw request
    console.log('Received signup request');
    
    // Parse request body
    const body = await request.json().catch(e => {
      console.error('Error parsing request body:', e);
      return null;
    });

    console.log('Request body:', { ...body, password: '[REDACTED]' });

    if (!body) {
      return NextResponse.json(
        { message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields', 
          received: { 
            name: !!name, 
            email: !!email, 
            password: !!password 
          }
        },
        { status: 400 }
      );
    }

    // Use a transaction to ensure both user and subscription are created
    const result = await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
      // Check if user already exists
      console.log('Checking for existing user with email:', email);
      const existingUser = await tx.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Check if basic plan exists
      console.log('Checking for basic plan');
      const basicPlan = await tx.subscriptionPlan.findFirst({
        where: { name: 'Basic' }
      });

      if (!basicPlan) {
        // Create basic plan if it doesn't exist
        console.log('Creating basic plan');
        const newBasicPlan = await tx.subscriptionPlan.create({
          data: {
            name: 'Basic',
            description: 'Perfect for getting started',
            priceMonthly: 9.99,
            priceYearly: 99.99,
            maxSessionsPerWeek: 2,
            canCreatePrivateTeams: false,
            hasPriorityBooking: false,
            hasAdvancedAnalytics: false,
          }
        });
        console.log('Basic plan created:', newBasicPlan.id);
      }

      // Hash password
      console.log('Hashing password');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      console.log('Creating new user');
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        }
      });

      console.log('User created successfully:', { id: user.id, email: user.email });

      // Create a basic subscription for the new user
      console.log('Creating user subscription');
      const subscription = await tx.userSubscription.create({
        data: {
          userId: user.id,
          planId: basicPlan ? basicPlan.id : 1,
          billingCycle: 'monthly',
          startDate: new Date(),
          isActive: true,
        }
      });

      console.log('User subscription created successfully');

      return { user, subscription };
    });

    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error details:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    
    if (error instanceof PrismaClientKnownRequestError) {
      console.error('Prisma error code:', error.code);
      if (error.code === 'P2002') {
        return NextResponse.json(
          { message: 'User with this email already exists' },
          { status: 400 }
        );
      }
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: error.message.includes('already exists') ? 400 : 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Something went wrong during signup. Please try again.' },
      { status: 500 }
    );
  }
} 