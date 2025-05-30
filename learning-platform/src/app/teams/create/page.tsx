'use client';

import { Container, Paper, Typography, TextField, Button, Box, FormControlLabel, Switch, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface FormData {
  name: string;
  description: string;
  maxMembers: number;
  isPremium: boolean;
  premiumFee?: number;
}

export default function CreateTeamPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Check if user is authenticated
      if (!session?.user) {
        throw new Error('You must be signed in to create a team');
      }

      const formData = new FormData(event.currentTarget);
      
      // Validate and parse form data
      const data: FormData = {
        name: formData.get('name')?.toString().trim() || '',
        description: formData.get('description')?.toString().trim() || '',
        maxMembers: parseInt(formData.get('maxMembers') as string, 10),
        isPremium: isPremium,
      };

      // Add premium fee if it's a premium team
      if (isPremium) {
        const premiumFee = parseFloat(formData.get('premiumFee') as string);
        if (!isNaN(premiumFee)) {
          data.premiumFee = premiumFee;
        }
      }

      // Client-side validation
      if (!data.name || !data.description) {
        throw new Error('Team name and description are required');
      }

      if (data.name.length > 255) {
        throw new Error('Team name must be less than 255 characters');
      }

      if (isNaN(data.maxMembers) || data.maxMembers < 2 || data.maxMembers > 10) {
        throw new Error('Team size must be between 2 and 10 members');
      }

      if (isPremium && (!data.premiumFee || data.premiumFee <= 0)) {
        throw new Error('Premium teams must have a valid fee greater than 0');
      }

      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to create team');
      }

      router.push('/teams');
      router.refresh();
    } catch (err) {
      console.error('Error creating team:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while creating the team');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Loading...</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create New Team
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              name="name"
              label="Team Name"
              required
              fullWidth
              inputProps={{ maxLength: 255 }}
              helperText="Enter a unique team name (max 255 characters)"
            />

            <TextField
              name="description"
              label="Description"
              multiline
              rows={3}
              required
              fullWidth
              inputProps={{ maxLength: 1000 }}
              helperText="Describe your team's purpose and goals"
            />

            <TextField
              name="maxMembers"
              label="Maximum Members"
              type="number"
              required
              fullWidth
              inputProps={{ min: 2, max: 10 }}
              defaultValue={5}
              helperText="Choose a team size between 2 and 10 members"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                />
              }
              label="Make this a premium team"
            />

            {isPremium && (
              <TextField
                name="premiumFee"
                label="Premium Fee (KES)"
                type="number"
                required
                fullWidth
                inputProps={{ min: 1, step: "0.01" }}
                helperText="Set the fee that members need to pay to join this team"
              />
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button href="/teams" variant="outlined">
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="contained"
                disabled={isSubmitting || status !== 'authenticated'}
              >
                {isSubmitting ? 'Creating...' : 'Create Team'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
} 