'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';
import GoogleMeetButton from '@/components/GoogleMeetButton';

interface Session {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: string;
  difficulty: string;
  maxParticipants: number;
  currentParticipants: number;
  meetLink: string | null;
  isCreator: boolean;
  hasJoined: boolean;
  meetingRequest?: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  } | null;
}

export default function SessionDetailsPage({ params }: { params: { sessionId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${params.sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch session details');
      }
      const data = await response.json();
      setSession(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching session details:', error);
      setError('Failed to load session details');
    } finally {
      setLoading(false);
    }
  }, [params.sessionId]);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  const handleStartSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${params.sessionId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start session');
      }
      
      await fetchSessionDetails();
      setError(null);
    } catch (error) {
      console.error('Error starting session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start session');
    }
  };

  const handleCreateMeet = async () => {
    try {
      const response = await fetch(`/api/sessions/${params.sessionId}/meet`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create meeting');
      }

      await fetchSessionDetails();
      setError(null);
    } catch (error) {
      console.error('Error creating meeting:', error);
      setError(error instanceof Error ? error.message : 'Failed to create meeting');
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!session) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h5" color="error">
          Session not found
        </Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h4" gutterBottom>
              {session.title}
            </Typography>
            <Typography color="text.secondary" paragraph>
              {session.description}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" gutterBottom>
              Start Time
            </Typography>
            <Typography color="text.secondary">
              {new Date(session.startTime).toLocaleString()}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" gutterBottom>
              End Time
            </Typography>
            <Typography color="text.secondary">
              {new Date(session.endTime).toLocaleString()}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" gutterBottom>
              Status
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={session.status}
                color={session.status === 'IN_PROGRESS' ? 'success' : 'default'}
              />
              {session.meetingRequest && (
                <Chip
                  label={`Meeting Request: ${session.meetingRequest.status}`}
                  color={
                    session.meetingRequest.status === 'APPROVED'
                      ? 'success'
                      : session.meetingRequest.status === 'REJECTED'
                      ? 'error'
                      : 'warning'
                  }
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1" gutterBottom>
              Difficulty
            </Typography>
            <Chip label={session.difficulty} />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Participants
            </Typography>
            <Typography color="text.secondary">
              {session.currentParticipants} / {session.maxParticipants}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" gap={2}>
              {session.isCreator && session.status === 'SCHEDULED' && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleStartSession}
                >
                  Start Session
                </Button>
              )}
              <GoogleMeetButton
                meetLink={session.meetLink}
                status={session.status}
                isCreator={session.isCreator}
                isTeamMember={session.hasJoined || session.isCreator}
                sessionId={params.sessionId}
                onCreateMeet={handleCreateMeet}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
} 