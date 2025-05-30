const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Get the Pro plan
  const proPlan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Pro' }
  });

  if (!proPlan) {
    console.error('Pro plan not found');
    return;
  }

  // Get your user account
  const user = await prisma.user.findUnique({
    where: { email: 'abateagegnehu574@gmail.com' }
  });

  if (!user) {
    console.error('User not found');
    return;
  }

  // Deactivate any existing subscriptions
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

  // Create new Pro subscription
  await prisma.userSubscription.create({
    data: {
      userId: user.id,
      planId: proPlan.id,
      billingCycle: 'MONTHLY',
      startDate: new Date(),
      isActive: true
    }
  });

  console.log('Successfully added Pro subscription to your account');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 