'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';

interface LeaveTeamButtonProps {
  teamId: string;
  isLeader: boolean;
  hasOtherMembers: boolean;
}

export default function LeaveTeamButton({ teamId, isLeader, hasOtherMembers }: LeaveTeamButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleLeaveTeam = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/teams/${teamId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to leave team');
      }

      router.refresh();
      if (isLeader && !hasOtherMembers) {
        // If the leader is the last member, redirect to teams page
        router.push('/teams');
      }
    } catch (error) {
      console.error('Error leaving team:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
      handleClose();
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="error"
        onClick={handleClickOpen}
        disabled={isLoading || (isLeader && hasOtherMembers)}
        fullWidth
      >
        {isLeader && hasOtherMembers
          ? "Transfer leadership before leaving"
          : "Leave Team"}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="leave-team-dialog-title"
      >
        <DialogTitle id="leave-team-dialog-title">
          {isLeader && !hasOtherMembers
            ? "Delete Team"
            : "Leave Team"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {isLeader && !hasOtherMembers
              ? "You are the last member of this team. The team will be deleted if you leave."
              : "Are you sure you want to leave this team? This action cannot be undone."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleLeaveTeam}
            color="error"
            disabled={isLoading}
            autoFocus
          >
            {isLoading ? "Leaving..." : "Leave Team"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
} 