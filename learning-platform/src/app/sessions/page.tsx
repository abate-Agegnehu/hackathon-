'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import GoogleMeetButton from '@/components/GoogleMeetButton';
import Link from 'next/link';

interface Session {
  id: string;
  title: string;
  description: string;
  startTime: string;
  duration: number;
  maxParticipants: number;
  currentParticipants: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  isCreator: boolean;
  hasJoined: boolean;
  meetLink: string | null;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingSession, setStartingSession] = useState<string | null>(null);
  const [creatingMeeting, setCreatingMeeting] = useState<string | null>(null);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    startTime: '',
    duration: 60,
    maxParticipants: 10,
    difficulty: 'INTERMEDIATE' as const,
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async (sessionId: string | number) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        fetchSessions(); // Refresh the sessions list
        alert('Successfully joined session!');
      } else {
        const errorMessage = data.error || data.message || 'Failed to join session';
        console.error('Join session error:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error joining session:', error instanceof Error ? error.message : 'Unknown error');
      alert('Network error: Failed to join session. Please try again.');
    }
  };

  const handleCompleteSession = async (sessionId: string | number) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        fetchSessions(); // Refresh the sessions list
        alert('Successfully completed session!');
      } else {
        const errorMessage = data.error || data.message || 'Failed to complete session';
        console.error('Complete session error:', data);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error completing session:', error);
      alert('Network error: Failed to complete session. Please try again.');
    }
  };

  const handleStartSession = async (sessionId: string | number) => {
    try {
      setStartingSession(sessionId.toString());
      const response = await fetch(`/api/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      await fetchSessions(); // Refresh the sessions list
      alert('Session started successfully!');
    } catch (error) {
      console.error('Error starting session:', error);
      alert(error instanceof Error ? error.message : 'Failed to start session');
    } finally {
      setStartingSession(null);
    }
  };

  const handleCreateSession = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSession),
      });

      if (response.ok) {
        setOpenCreateDialog(false);
        fetchSessions();
        setNewSession({
          title: '',
          description: '',
          startTime: '',
          duration: 60,
          maxParticipants: 10,
          difficulty: 'INTERMEDIATE',
        });
      } else {
        const error = await response.json();
        alert(error.message);
      }
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session');
    }
  };

  const handleCreateMeeting = async (sessionId: string | number) => {
    try {
      setCreatingMeeting(sessionId.toString());
      const response = await fetch(`/api/sessions/${sessionId}/meet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create meeting');
      }

      await fetchSessions(); // Refresh the sessions list
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert(error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      setCreatingMeeting(null);
    }
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'SCHEDULED':
        return 'primary';
      case 'IN_PROGRESS':
        return 'success';
      case 'COMPLETED':
        return 'default';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getDifficultyColor = (difficulty: Session['difficulty']) => {
    switch (difficulty) {
      case 'BEGINNER':
        return 'success';
      case 'INTERMEDIATE':
        return 'warning';
      case 'ADVANCED':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Learning Sessions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
        >
          Create Session
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Participants</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Difficulty</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : sessions && Array.isArray(sessions) && sessions.length > 0 ? (
              sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <Link href={`/sessions/${session.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {session.title}
                    </Link>
                  </TableCell>
                  <TableCell>{session.description}</TableCell>
                  <TableCell>{new Date(session.startTime).toLocaleString()}</TableCell>
                  <TableCell>{session.duration} min</TableCell>
                  <TableCell>
                    {session.currentParticipants}/{session.maxParticipants}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={session.status}
                      color={
                        session.status === 'IN_PROGRESS'
                          ? 'success'
                          : session.status === 'SCHEDULED'
                          ? 'primary'
                          : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={session.difficulty}
                      color={
                        session.difficulty === 'BEGINNER'
                          ? 'success'
                          : session.difficulty === 'INTERMEDIATE'
                          ? 'warning'
                          : 'error'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={1} justifyContent="flex-end">
                      {session.status === 'SCHEDULED' && !session.hasJoined && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleJoinSession(session.id)}
                          disabled={session.currentParticipants >= session.maxParticipants}
                        >
                          Join
                        </Button>
                      )}
                      {(session.isCreator || session.hasJoined) && (
                        <>
                          {session.status === 'SCHEDULED' && session.isCreator && (
                            <Button
                              variant="contained"
                              size="small"
                              color="primary"
                              onClick={() => handleStartSession(session.id)}
                              disabled={startingSession === session.id.toString()}
                            >
                              {startingSession === session.id.toString() ? 'Starting...' : 'Start'}
                            </Button>
                          )}
                          {session.status === 'IN_PROGRESS' && (
                            <GoogleMeetButton
                              meetLink={session.meetLink}
                              status={session.status}
                              isCreator={session.isCreator}
                              isTeamMember={session.hasJoined || session.isCreator}
                              sessionId={session.id}
                              onCreateMeet={() => handleCreateMeeting(session.id)}
                            />
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No sessions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Session Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Session</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Title"
              value={newSession.title}
              onChange={(e) =>
                setNewSession({ ...newSession, title: e.target.value })
              }
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={newSession.description}
              onChange={(e) =>
                setNewSession({ ...newSession, description: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              required
            />
            <TextField
              label="Start Time"
              type="datetime-local"
              value={newSession.startTime}
              onChange={(e) =>
                setNewSession({ ...newSession, startTime: e.target.value })
              }
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Duration (minutes)"
              type="number"
              value={newSession.duration}
              onChange={(e) =>
                setNewSession({
                  ...newSession,
                  duration: parseInt(e.target.value),
                })
              }
              fullWidth
              required
            />
            <TextField
              label="Max Participants"
              type="number"
              value={newSession.maxParticipants}
              onChange={(e) =>
                setNewSession({
                  ...newSession,
                  maxParticipants: parseInt(e.target.value),
                })
              }
              fullWidth
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={newSession.difficulty}
                onChange={(e) =>
                  setNewSession({
                    ...newSession,
                    difficulty: e.target.value as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
                  })
                }
                label="Difficulty"
              >
                <MenuItem value="BEGINNER">Beginner</MenuItem>
                <MenuItem value="INTERMEDIATE">Intermediate</MenuItem>
                <MenuItem value="ADVANCED">Advanced</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateSession}
            variant="contained"
            disabled={
              !newSession.title ||
              !newSession.description ||
              !newSession.startTime
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
} 