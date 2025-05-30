'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  EmojiEvents as TrophyIcon,
  School as SchoolIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface ProgressStats {
  totalHours: number;
  completedSessions: number;
  earnedBadges: number;
  overallProgress: number;
  recentActivities: Array<{
    id: string;
    type: 'SESSION' | 'CHALLENGE' | 'BADGE';
    title: string;
    date: string;
    progress?: number;
  }>;
  skillProgress: Array<{
    name: string;
    level: number;
    progress: number;
  }>;
}

const defaultStats: ProgressStats = {
  totalHours: 0,
  completedSessions: 0,
  earnedBadges: 0,
  overallProgress: 0,
  recentActivities: [],
  skillProgress: [],
};

export default function ProgressPage() {
  const [stats, setStats] = useState<ProgressStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      const response = await fetch('/api/progress');
      if (!response.ok) {
        throw new Error('Failed to fetch progress data');
      }
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching progress:', error);
      setError('Failed to load progress data');
    } finally {
      setIsLoading(false);
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
      <Typography variant="h4" component="h1" gutterBottom>
        Learning Progress
      </Typography>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Total Hours</Typography>
              </Box>
              <Typography variant="h4">{stats.totalHours}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SchoolIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Sessions</Typography>
              </Box>
              <Typography variant="h4">{stats.completedSessions}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrophyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Badges</Typography>
              </Box>
              <Typography variant="h4">{stats.earnedBadges}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUpIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Progress</Typography>
              </Box>
              <Typography variant="h4">{stats.overallProgress}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Skill Progress */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Skill Development
        </Typography>
        <Grid container spacing={3}>
          {stats.skillProgress.map((skill) => (
            <Grid item xs={12} sm={6} key={skill.name}>
              <Box sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle1">{skill.name}</Typography>
                  <Chip
                    label={`Level ${skill.level}`}
                    size="small"
                    color="primary"
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={skill.progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary" align="right" sx={{ mt: 0.5 }}>
                  {skill.progress}%
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Recent Activities */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Activities
        </Typography>
        <List>
          {stats.recentActivities.map((activity) => (
            <ListItem key={activity.id}>
              <ListItemIcon>
                {activity.type === 'SESSION' && <SchoolIcon color="primary" />}
                {activity.type === 'CHALLENGE' && <TrendingUpIcon color="primary" />}
                {activity.type === 'BADGE' && <TrophyIcon color="primary" />}
              </ListItemIcon>
              <ListItemText
                primary={activity.title}
                secondary={new Date(activity.date).toLocaleDateString()}
              />
              {activity.progress !== undefined && (
                <Chip
                  label={`${activity.progress}%`}
                  size="small"
                  color={activity.progress === 100 ? 'success' : 'primary'}
                />
              )}
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
} 