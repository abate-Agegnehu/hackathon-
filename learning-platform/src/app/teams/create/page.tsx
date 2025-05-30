import { Container, Paper, Typography, TextField, Button, Box } from '@mui/material';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function CreateTeamPage() {
  async function createTeam(formData: FormData) {
    'use server';

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      throw new Error('Unauthorized');
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const maxMembers = parseInt(formData.get('maxMembers') as string);

    if (!name || !description || !maxMembers) {
      throw new Error('All fields are required');
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
        maxMembers,
        members: {
          create: {
            userId: user.id,
            role: 'LEADER'
          }
        }
      }
    });

    redirect('/teams');
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create New Team
        </Typography>

        <form action={createTeam}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              name="name"
              label="Team Name"
              required
              fullWidth
            />

            <TextField
              name="description"
              label="Description"
              multiline
              rows={3}
              required
              fullWidth
            />

            <TextField
              name="maxMembers"
              label="Maximum Members"
              type="number"
              required
              fullWidth
              inputProps={{ min: 2, max: 10 }}
              defaultValue={5}
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button href="/teams" variant="outlined">
                Cancel
              </Button>
              <Button type="submit" variant="contained">
                Create Team
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
} 