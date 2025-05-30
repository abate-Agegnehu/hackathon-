'use client';

import { Button, CircularProgress, Tooltip, Box, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';
import { VideoCall as VideoCallIcon } from '@mui/icons-material';
import { useState } from 'react';

interface GoogleMeetButtonProps {
  meetLink?: string | null;
  status: string;
  isCreator: boolean;
  isTeamMember: boolean;
  sessionId: string;
  onCreateMeet?: () => Promise<void>;
}

export default function GoogleMeetButton({ 
  meetLink, 
  status, 
  isCreator, 
  isTeamMember,
  sessionId,
  onCreateMeet 
}: GoogleMeetButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

  const handleJoinRequest = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/meet/join-request`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send join request');
      }

      setRequestStatus('pending');
      setShowRequestDialog(true);
    } catch (error) {
      console.error('Failed to send join request:', error);
      alert(error instanceof Error ? error.message : 'Failed to send join request');
    } finally {
      setLoading(false);
    }
  };

  const handleMeetAction = async () => {
    if (!isTeamMember) {
      return;
    }

    if (isCreator && !meetLink && onCreateMeet) {
      setLoading(true);
      try {
        await onCreateMeet();
      } catch (error) {
        console.error('Failed to create meet:', error);
      } finally {
        setLoading(false);
      }
    } else if (meetLink) {
      window.open(meetLink, '_blank');
    } else if (!isCreator && requestStatus === 'none') {
      setShowRequestDialog(true);
    }
  };

  // Only team members can see/use the button
  if (!isTeamMember) {
    return null;
  }

  let buttonText = 'Join Meeting';
  let tooltipText = '';
  let isDisabled = false;

  if (isCreator) {
    if (!meetLink) {
      buttonText = 'Create Meeting';
      tooltipText = 'Create a new Google Meet for this session';
    } else {
      buttonText = 'Start Meeting';
      tooltipText = 'Start the Google Meet session';
    }
  } else {
    if (!meetLink) {
      switch (requestStatus) {
        case 'none':
          buttonText = 'Request to Join';
          tooltipText = 'Request to join the meeting';
          break;
        case 'pending':
          buttonText = 'Request Pending';
          tooltipText = 'Your join request is pending approval';
          isDisabled = true;
          break;
        case 'rejected':
          buttonText = 'Request Rejected';
          tooltipText = 'Your join request was rejected';
          isDisabled = true;
          break;
      }
    } else {
      tooltipText = 'Join the Google Meet session';
    }
  }

  if (status !== 'IN_PROGRESS') {
    isDisabled = true;
    tooltipText = 'Session must be in progress to join meeting';
  }

  return (
    <>
      <Tooltip title={tooltipText}>
        <span>
          <Button
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VideoCallIcon />}
            onClick={handleMeetAction}
            disabled={isDisabled || loading}
            sx={{ ml: 1 }}
          >
            {buttonText}
          </Button>
        </span>
      </Tooltip>

      <Dialog open={showRequestDialog} onClose={() => setShowRequestDialog(false)}>
        <DialogTitle>
          {requestStatus === 'none' ? 'Request to Join Meeting' : 'Join Request Status'}
        </DialogTitle>
        <DialogContent>
          {requestStatus === 'none' ? (
            <Typography>
              Would you like to send a request to join this meeting? The session creator will be notified and can approve your request.
            </Typography>
          ) : (
            <Typography>
              {requestStatus === 'pending' && 'Your request to join has been sent. Please wait for approval.'}
              {requestStatus === 'rejected' && 'Your request to join was rejected.'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {requestStatus === 'none' ? (
            <>
              <Button onClick={() => setShowRequestDialog(false)}>Cancel</Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleJoinRequest}
                disabled={loading}
              >
                {loading ? 'Sending Request...' : 'Send Request'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setShowRequestDialog(false)}>Close</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
} 