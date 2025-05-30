'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Timeline,
  School,
  Group,
  EmojiEvents,
  SvgIconComponent,
} from '@mui/icons-material';

interface DashboardStats {
  totalSessions: number;
  completedSessions: number;
  activeTeams: number;
  earnedBadges: number;
  progress: number;
  upcomingSessions: Array<{
    id: number;
    title: string;
    startTime: string;
  }>;
  recentAchievements: Array<{
    id: number;
    title: string;
    date: string;
  }>;
}

const defaultStats: DashboardStats = {
  totalSessions: 0,
  completedSessions: 0,
  activeTeams: 0,
  earnedBadges: 0,
  progress: 0,
  upcomingSessions: [],
  recentAchievements: [],
};

interface StatCardProps {
  title: string;
  value: number;
  icon: SvgIconComponent;
}

const StatCard = ({ title, value, icon: Icon }: StatCardProps) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Icon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
        <Box>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const data = await response.json();
        setStats({
          ...defaultStats,
          ...data,
          upcomingSessions: Array.isArray(data.upcomingSessions) ? data.upcomingSessions : [],
          recentAchievements: Array.isArray(data.recentAchievements) ? data.recentAchievements : [],
        });
        setError(null);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error" align="center">
          {error}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Sessions"
            value={stats.totalSessions}
            icon={Timeline}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Teams"
            value={stats.activeTeams}
            icon={Group}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed Sessions"
            value={stats.completedSessions}
            icon={School}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Earned Badges"
            value={stats.earnedBadges}
            icon={EmojiEvents}
          />
        </Grid>

        {/* Progress Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Learning Progress
            </Typography>
            <Box display="flex" alignItems="center">
              <Box flexGrow={1} mr={2}>
                <LinearProgress
                  variant="determinate"
                  value={stats.progress}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {stats.progress}%
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Upcoming Sessions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Sessions
            </Typography>
            <List>
              {stats.upcomingSessions.length > 0 ? (
                stats.upcomingSessions.map((session) => (
                  <ListItem
                    key={session.id}
                    secondaryAction={
                      <Button variant="outlined" size="small">
                        Join
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={session.title}
                      secondary={new Date(session.startTime).toLocaleString()}
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="No upcoming sessions" />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Recent Achievements */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Recent Achievements
            </Typography>
            <List>
              {stats.recentAchievements.length > 0 ? (
                stats.recentAchievements.map((achievement) => (
                  <ListItem key={achievement.id}>
                    <ListItemText
                      primary={achievement.title}
                      secondary={new Date(achievement.date).toLocaleDateString()}
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="No recent achievements" />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
} 