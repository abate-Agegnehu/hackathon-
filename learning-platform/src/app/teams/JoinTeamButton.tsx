'use client';

import { useState } from 'react';
import { Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useRouter } from 'next/navigation';

interface JoinTeamButtonProps {
  teamId: string;
  disabled?: boolean;
}

export default function JoinTeamButton({ teamId, disabled }: JoinTeamButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleClickOpen = () => {
    setOpen(true);
    setError('');
  };

  const handleClose = () => {
    setOpen(false);
    setPhoneNumber('');
    setError('');
  };

  const formatPhoneNumber = (number: string) => {
    // Remove any non-digit characters
    const cleaned = number.replace(/\D/g, '');
    
    // If it starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      return '254' + cleaned.slice(1);
    }
    
    // If it starts with 7 or 1, add 254
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return '254' + cleaned;
    }
    
    // If it already starts with 254, return as is
    if (cleaned.startsWith('254')) {
      return cleaned;
    }
    
    return cleaned;
  };

  const validatePhoneNumber = (number: string) => {
    const cleaned = formatPhoneNumber(number);
    
    // Must be exactly 12 digits (254 + 9 digits)
    if (cleaned.length !== 12) {
      return 'Phone number must be 9 digits after 254';
    }
    
    // Must start with 254
    if (!cleaned.startsWith('254')) {
      return 'Phone number must start with 254';
    }
    
    // The digit after 254 must be 7 or 1
    if (!['7', '1'].includes(cleaned[3])) {
      return 'Invalid phone number format';
    }
    
    return '';
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value;
    setPhoneNumber(newNumber);
    setError(validatePhoneNumber(newNumber));
  };

  const handleJoinTeam = async () => {
    try {
      if (!phoneNumber) {
        setError('Phone number is required');
        return;
      }

      const validationError = validatePhoneNumber(phoneNumber);
      if (validationError) {
        setError(validationError);
        return;
      }

      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      setLoading(true);
      const response = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: formattedNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join team');
      }

      // If payment is required, show the payment info
      if (data.requiresPayment) {
        alert('Please complete the payment on your phone to join the team.');
      }

      // Close the dialog and refresh the page
      handleClose();
      router.refresh();
    } catch (error) {
      console.error('Error joining team:', error);
      setError(error instanceof Error ? error.message : 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        onClick={handleClickOpen}
        disabled={disabled}
      >
        Join Team
      </Button>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Join Team</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Phone Number"
            type="tel"
            fullWidth
            variant="outlined"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            error={!!error}
            helperText={error || 'Enter your phone number (e.g., 0712345678 or 254712345678)'}
            disabled={loading}
            placeholder="0712345678"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleJoinTeam} 
            disabled={loading || !!error}
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? 'Joining...' : 'Join'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
} 