import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create subscription plans
  const plans = [
    {
      name: 'Free',
      description: 'Basic access to the platform',
      priceMonthly: 0,
      priceYearly: 0,
      maxSessionsPerWeek: 2,
      canCreatePrivateTeams: false,
      hasPriorityBooking: false,
      hasAdvancedAnalytics: false,
    },
    {
      name: 'Pro',
      description: 'Professional features including premium team creation',
      priceMonthly: 999,
      priceYearly: 9990,
      maxSessionsPerWeek: 10,
      canCreatePrivateTeams: true,
      hasPriorityBooking: true,
      hasAdvancedAnalytics: false,
    },
    {
      name: 'Enterprise',
      description: 'Full platform access with advanced features',
      priceMonthly: 2999,
      priceYearly: 29990,
      maxSessionsPerWeek: -1, // Unlimited
      canCreatePrivateTeams: true,
      hasPriorityBooking: true,
      hasAdvancedAnalytics: true,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log('Created subscription plans');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 