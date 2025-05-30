'use client';

import { useSession } from 'next-auth/react';
import { Box, Container, Typography, Button, Card, CardContent } from '@mui/material';
import Grid2 from '@mui/material/Unstable_Grid2';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <Box>
      {/* Hero Section */}
      <Box 
        sx={{ 
          bgcolor: 'primary.main',
          color: 'white',
          py: 8,
          mb: 6
        }}
      >
        <Container maxWidth="lg">
          <Grid2 container spacing={4} alignItems="center">
            <Grid2 xs={12} md={6}>
              <Typography variant="h1" gutterBottom>
                Learn, Grow, Achieve
              </Typography>
              <Typography variant="h5" paragraph>
                Join our learning platform and unlock your potential with interactive sessions,
                challenges, and expert guidance.
              </Typography>
              {!session ? (
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  onClick={() => router.push('/auth/signup')}
                  sx={{ mr: 2 }}
                >
                  Get Started
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              )}
            </Grid2>
          </Grid2>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg">
        <Grid2 container spacing={4}>
          <Grid2 xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Live Sessions
                </Typography>
                <Typography color="text.secondary">
                  Join interactive live sessions with expert instructors and learn in real-time.
                </Typography>
              </CardContent>
            </Card>
          </Grid2>
          <Grid2 xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Challenges
                </Typography>
                <Typography color="text.secondary">
                  Test your skills with practical challenges and earn rewards.
                </Typography>
              </CardContent>
            </Card>
          </Grid2>
          <Grid2 xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Community
                </Typography>
                <Typography color="text.secondary">
                  Connect with other learners and share your journey.
                </Typography>
              </CardContent>
            </Card>
          </Grid2>
        </Grid2>
      </Container>
    </Box>
  );
}
