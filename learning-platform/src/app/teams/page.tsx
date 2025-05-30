import { Container, Grid, Typography, Box, Button } from '@mui/material';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import TeamCard from './TeamCard';

interface Team {
  id: string;
  name: string;
  description: string;
  status: string;
  maxMembers: number;
  members: {
    id: string;
    user: {
      name: string | null;
      email: string;
    };
    role: string;
  }[];
  challenges: {
    status: string;
  }[];
}

export default async function TeamsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  const teams = await prisma.team.findMany({
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
  }) as Team[];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Learning Teams</Typography>
        <Link href="/teams/create">
          <Button variant="contained" color="primary">
            + Create Team
          </Button>
        </Link>
      </Box>

      <Grid container spacing={3}>
        {teams.map((team) => (
          <Grid item xs={12} sm={6} key={team.id}>
            <TeamCard team={team} />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
} 