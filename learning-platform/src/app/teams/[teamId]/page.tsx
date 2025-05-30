import { Container, Grid, Paper, Typography, Box } from '@mui/material';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import TeamChat from './TeamChat';

interface PageProps {
  params: {
    teamId: string;
  };
}

export default async function TeamPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    redirect('/auth/signin');
  }

  // Check if user is a member of the team
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      teamId: params.teamId,
      userId: user.id
    }
  });

  if (!teamMember) {
    redirect('/teams');
  }

  // Get team details
  const team = await prisma.team.findUnique({
    where: { id: params.teamId },
    include: {
      members: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      challenges: true,
    },
  });

  if (!team) {
    redirect('/teams');
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={4}>
        {/* Team Info Section */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              {team.name}
            </Typography>
            <Typography color="text.secondary" paragraph>
              {team.description}
            </Typography>
            
            <Typography variant="subtitle2" gutterBottom>
              Team Members ({team.members.length}/{team.maxMembers})
            </Typography>
            {team.members.map((member) => (
              <Typography key={member.id} variant="body2">
                {member.user.name} ({member.role})
              </Typography>
            ))}

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Challenges
              </Typography>
              <Typography variant="body2">
                Active: {team.challenges.filter(c => c.status === 'ACTIVE').length}
              </Typography>
              <Typography variant="body2">
                Completed: {team.challenges.filter(c => c.status === 'COMPLETED').length}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Team Chat Section */}
        <Grid item xs={12} md={8}>
          <TeamChat teamId={params.teamId} />
        </Grid>
      </Grid>
    </Container>
  );
} 