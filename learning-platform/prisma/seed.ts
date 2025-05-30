const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create a demo user
  const hashedPassword = await bcrypt.hash('demo123', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
    },
  });

  console.log('Created demo user');

  // Create initial badges
  const badges = [
    {
      name: 'Quick Starter',
      description: 'Complete your first learning session',
      imageUrl: '/badges/quick-starter.png',
    },
    {
      name: 'Challenge Champion',
      description: 'Complete 5 learning challenges',
      imageUrl: '/badges/champion.png',
    },
    {
      name: 'Team Player',
      description: 'Join your first team',
      imageUrl: '/badges/team-player.png',
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: badge,
      create: badge,
    });
  }

  console.log('Created badges');

  // Create initial skills
  const skills = [
    {
      name: 'Problem Solving',
      description: 'Ability to analyze and solve complex problems',
    },
    {
      name: 'Team Collaboration',
      description: 'Working effectively with others in a team setting',
    },
    {
      name: 'Technical Knowledge',
      description: 'Understanding and applying technical concepts',
    },
  ];

  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: skill,
      create: skill,
    });
  }

  console.log('Created skills');

  // Delete existing challenges
  await prisma.challenge.deleteMany();

  // Create initial challenges
  const challenges = [
    {
      title: 'Complete Your Profile',
      description: 'Fill out all sections of your profile to help others get to know you better.',
      goalTarget: 1,
      rewardPoints: 100,
      isActive: true,
    },
    {
      title: 'First Learning Path',
      description: 'Complete your first learning path to earn points and unlock achievements.',
      goalTarget: 1,
      rewardPoints: 200,
      isActive: true,
    },
    {
      title: 'Community Contributor',
      description: 'Help others by answering questions in the community forum.',
      goalTarget: 5,
      rewardPoints: 300,
      isActive: true,
    },
  ];

  for (const challenge of challenges) {
    await prisma.challenge.create({
      data: challenge,
    });
  }

  console.log('Created challenges');

  // Add some initial progress for the demo user
  const quickStarterBadge = await prisma.badge.findFirst({
    where: { name: 'Quick Starter' },
  });

  if (quickStarterBadge) {
    await prisma.userBadge.upsert({
      where: {
        userId_badgeId: {
          userId: demoUser.id,
          badgeId: quickStarterBadge.id,
        },
      },
      update: {},
      create: {
        userId: demoUser.id,
        badgeId: quickStarterBadge.id,
      },
    });
  }

  const problemSolvingSkill = await prisma.skill.findFirst({
    where: { name: 'Problem Solving' },
  });

  if (problemSolvingSkill) {
    await prisma.userSkill.upsert({
      where: {
        userId_skillId: {
          userId: demoUser.id,
          skillId: problemSolvingSkill.id,
        },
      },
      update: {
        level: 2,
        progress: 65,
      },
      create: {
        userId: demoUser.id,
        skillId: problemSolvingSkill.id,
        level: 2,
        progress: 65,
      },
    });
  }

  console.log('Added initial progress for demo user');

  // Create initial teams
  const teams = [
    {
      name: 'Web Development Squad',
      description: 'A team focused on learning modern web development technologies',
      maxMembers: 5,
      status: 'ACTIVE',
      members: {
        create: {
          userId: demoUser.id,
          role: 'LEADER',
        },
      },
    },
    {
      name: 'Data Science Group',
      description: 'Exploring data science and machine learning together',
      maxMembers: 5,
      status: 'ACTIVE',
      members: {
        create: {
          userId: demoUser.id,
          role: 'LEADER',
        },
      },
    },
  ];

  for (const team of teams) {
    await prisma.team.create({
      data: team,
    });
  }

  console.log('Created teams');

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

  // Create a Pro subscription for the demo user
  const proPlan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Pro' }
  });

  if (proPlan) {
    await prisma.userSubscription.create({
      data: {
        userId: demoUser.id,
        planId: proPlan.id,
        billingCycle: 'MONTHLY',
        startDate: new Date(),
        isActive: true,
      }
    });
  }

  console.log('Created subscription plans');

  console.log('Seeding finished');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 