'use client';

import { Container, Paper, Typography, TextField, Button, Box, FormControlLabel, Switch, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CreateTeamPage() {
  const router = useRouter();
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const data = {
        name: formData.get('name'),
        description: formData.get('description'),
        maxMembers: parseInt(formData.get('maxMembers') as string),
        isPremium: isPremium,
        premiumFee: isPremium ? parseFloat(formData.get('premiumFee') as string) : 0
      };

      if (!data.name || !data.description || !data.maxMembers) {
        throw new Error('All required fields must be filled');
      }

      if (data.maxMembers < 2 || data.maxMembers > 10) {
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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create team');
      }

      router.push('/teams');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <form onSubmit={handleSubmit}>
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
                disabled={isSubmitting}
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