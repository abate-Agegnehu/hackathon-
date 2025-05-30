'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Timer as TimerIcon,
  EmojiEvents as TrophyIcon,
  Group as GroupIcon,
  School as SchoolIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface Challenge {
  id: number;
  title: string;
  description: string;
  goalTarget: number;
  rewardPoints: number;
  isActive: boolean;
  progress?: number;
  completed?: boolean;
  completedAt?: string | null;
}

interface NewChallenge {
  title: string;
  description: string;
  goalTarget: number;
  rewardPoints: number;
  isActive: boolean;
}

const defaultNewChallenge: NewChallenge = {
  title: '',
  description: '',
  goalTarget: 1,
  rewardPoints: 100,
  isActive: true,
};

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [newChallenge, setNewChallenge] = useState<NewChallenge>(defaultNewChallenge);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const response = await fetch('/api/challenges');
      if (!response.ok) {
        throw new Error('Failed to fetch challenges');
      }
      const data = await response.json();
      setChallenges(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      console.error('Error fetching challenges:', error);
      setError('Failed to load challenges');
      setChallenges([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    try {
      // Validate form fields
      if (!newChallenge.title.trim()) {
        alert('Title is required');
        return;
      }
      if (!newChallenge.description.trim()) {
        alert('Description is required');
        return;
      }
      if (newChallenge.goalTarget < 1) {
        alert('Goal target must be at least 1');
        return;
      }
      if (newChallenge.rewardPoints < 1) {
        alert('Reward points must be at least 1');
        return;
      }

      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newChallenge,
          title: newChallenge.title.trim(),
          description: newChallenge.description.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setOpenCreateDialog(false);
        fetchChallenges();
        setNewChallenge(defaultNewChallenge);
      } else {
        // Show the specific error message from the server
        alert(data.error || data.message || 'Failed to create challenge');
        console.error('Server error:', data);
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
      alert('Network error: Failed to create challenge. Please try again.');
    }
  };

  const handleUpdateProgress = async (challengeId: number, progress: number) => {
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ challengeId, progress }),
      });

      const data = await response.json();

      if (response.ok) {
        fetchChallenges();
        if (data.badgeAwarded) {
          alert('Congratulations! You\'ve completed the challenge and earned a badge! 🏆');
        }
      } else {
        const error = await response.json();
        alert(error.message);
      }
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      alert('Failed to update progress');
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          <InfoIcon color="error" />
          <Typography color="error">
            {error}
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Learning Challenges
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
        >
          Create Challenge
        </Button>
      </Box>

      <Grid container spacing={3}>
        {challenges.map((challenge) => (
          <Grid item xs={12} md={6} key={challenge.id}>
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {challenge.title}
                  </Typography>
                  <Typography color="text.secondary" paragraph>
                    {challenge.description}
                  </Typography>
                </Box>
                <Chip
                  label={`${challenge.rewardPoints} Points`}
                  color="primary"
                  icon={<TrophyIcon />}
                />
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Progress: {challenge.progress || 0} / {challenge.goalTarget}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={((challenge.progress || 0) / challenge.goalTarget) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              {!challenge.completed && (
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={() => handleUpdateProgress(challenge.id, (challenge.progress || 0) + 1)}
                  >
                    Update Progress
                  </Button>
                </Box>
              )}

              {challenge.completed && (
                <Box display="flex" justifyContent="flex-end">
                  <Chip
                    label="Completed"
                    color="success"
                    icon={<TrophyIcon />}
                  />
                </Box>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Create Challenge Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Challenge</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Title"
              value={newChallenge.title}
              onChange={(e) =>
                setNewChallenge({ ...newChallenge, title: e.target.value })
              }
              fullWidth
              required
              error={newChallenge.title.trim() === ''}
              helperText={newChallenge.title.trim() === '' ? 'Title is required' : ''}
            />
            <TextField
              label="Description"
              value={newChallenge.description}
              onChange={(e) =>
                setNewChallenge({ ...newChallenge, description: e.target.value })
              }
              fullWidth
              multiline
              rows={4}
              required
              error={newChallenge.description.trim() === ''}
              helperText={newChallenge.description.trim() === '' ? 'Description is required' : ''}
            />
            <TextField
              label="Goal Target"
              type="number"
              value={newChallenge.goalTarget}
              onChange={(e) =>
                setNewChallenge({
                  ...newChallenge,
                  goalTarget: parseInt(e.target.value) || 1,
                })
              }
              fullWidth
              required
              error={newChallenge.goalTarget < 1}
              helperText={newChallenge.goalTarget < 1 ? 'Goal target must be at least 1' : 'The number of times this challenge needs to be completed'}
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Reward Points"
              type="number"
              value={newChallenge.rewardPoints}
              onChange={(e) =>
                setNewChallenge({
                  ...newChallenge,
                  rewardPoints: parseInt(e.target.value) || 100,
                })
              }
              fullWidth
              required
              error={newChallenge.rewardPoints < 1}
              helperText={newChallenge.rewardPoints < 1 ? 'Reward points must be at least 1' : 'Points awarded upon completion'}
              inputProps={{ min: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateChallenge}
            variant="contained"
            disabled={
              !newChallenge.title.trim() ||
              !newChallenge.description.trim() ||
              newChallenge.goalTarget < 1 ||
              newChallenge.rewardPoints < 1
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Challenge Details Dialog */}
      <Dialog
        open={openDetailsDialog}
        onClose={() => {
          setOpenDetailsDialog(false);
          setSelectedChallenge(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        {selectedChallenge && (
          <>
            <DialogTitle>{selectedChallenge.title}</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1" paragraph>
                  {selectedChallenge.description}
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  <Chip
                    label={`${selectedChallenge.rewardPoints} Points`}
                    color="primary"
                    icon={<TrophyIcon />}
                  />
                  <Chip
                    label={selectedChallenge.completed ? 'Completed' : 'In Progress'}
                    color={selectedChallenge.completed ? 'success' : 'warning'}
                  />
                </Box>
                <Typography variant="subtitle2" gutterBottom>
                  Progress
                </Typography>
                <Typography variant="body2" paragraph>
                  {selectedChallenge.progress || 0} / {selectedChallenge.goalTarget}
                </Typography>
                {selectedChallenge.completedAt && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Completed At
                    </Typography>
                    <Typography variant="body2">
                      {new Date(selectedChallenge.completedAt).toLocaleDateString()}
                    </Typography>
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setOpenDetailsDialog(false);
                  setSelectedChallenge(null);
                }}
              >
                Close
              </Button>
              {!selectedChallenge.completed && (
                <Button
                  variant="contained"
                  onClick={() => handleUpdateProgress(selectedChallenge.id, (selectedChallenge.progress || 0) + 1)}
                >
                  Update Progress
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
} 