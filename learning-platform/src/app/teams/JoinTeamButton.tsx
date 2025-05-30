'use client';

import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';

interface JoinTeamButtonProps {
  teamId: string;
  disabled?: boolean;
}

export default function JoinTeamButton({ teamId, disabled }: JoinTeamButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoinTeam = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join team');
      }

      // Refresh the page to show updated team status
      router.refresh();
    } catch (error) {
      console.error('Error joining team:', error);
      alert(error instanceof Error ? error.message : 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={handleJoinTeam}
      disabled={disabled || loading}
      startIcon={loading && <CircularProgress size={20} color="inherit" />}
    >
      {loading ? 'Joining...' : 'Join Team'}
    </Button>
  );
} 