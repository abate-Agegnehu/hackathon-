'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import StarIcon from '@mui/icons-material/Star';
import PaymentDialog from './PaymentDialog';

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxSessionsPerWeek: number;
  canCreatePrivateTeams: boolean;
  hasPriorityBooking: boolean;
  hasAdvancedAnalytics: boolean;
}

interface UserSubscription {
  isActive: boolean;
  plan: SubscriptionPlan | null;
  subscriptionId: number | null;
  expiresAt: string | null;
}

export default function SubscriptionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch available plans
        const plansResponse = await fetch('/api/subscription/plans');
        if (!plansResponse.ok) throw new Error('Failed to fetch subscription plans');
        const plansData = await plansResponse.json();
        setPlans(plansData);

        // Fetch user's current subscription
        const subscriptionResponse = await fetch('/api/users/subscription');
        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json();
          setUserSubscription(subscriptionData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchData();
    }
  }, [session]);

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const handleSubscribe = async (planId: number) => {
    try {
      // First, check if the plan requires payment
      const plan = plans.find(p => p.id === planId);
      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      if (plan.priceMonthly > 0) {
        // For paid plans, open payment dialog
        setSelectedPlan(plan);
        setShowPaymentDialog(true);
        return;
      }

      // For free plan, proceed with subscription
      const response = await fetch('/api/subscription/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      const result = await response.json();
      
      if (result.requiresPayment) {
        // Store payment details and show payment dialog
        setPaymentDetails(result.payment);
        setShowPaymentDialog(true);
      } else {
        // Subscription activated successfully
        router.refresh();
        setSuccess('Successfully subscribed to the plan!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    }
  };

  const handlePaymentSubmit = async (phoneNumber: string) => {
    try {
      if (!selectedPlan) {
        throw new Error('No plan selected');
      }

      const response = await fetch('/api/subscription/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          phoneNumber,
          paymentMethod: 'MPESA'
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate payment');
      }

      const result = await response.json();
      
      if (result.requiresPayment) {
        // Show payment instructions
        setPaymentDetails(result.payment);
        setSuccess('Payment initiated. Please complete the payment on your phone.');
      } else {
        // Subscription activated
        setShowPaymentDialog(false);
        router.refresh();
        setSuccess('Successfully subscribed to the plan!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        Subscription Plans
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {userSubscription?.isActive && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You are currently subscribed to the {userSubscription.plan?.name} plan.
          {userSubscription.expiresAt && (
            <> Your subscription expires on {new Date(userSubscription.expiresAt).toLocaleDateString()}.</>
          )}
        </Alert>
      )}

      <Grid container spacing={3}>
        {plans.map((plan) => (
          <Grid item xs={12} md={4} key={plan.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                position: 'relative',
                ...(userSubscription?.plan?.id === plan.id && {
                  border: '2px solid',
                  borderColor: 'primary.main',
                })
              }}
            >
              {userSubscription?.plan?.id === plan.id && (
                <Chip
                  label="Current Plan"
                  color="primary"
                  icon={<StarIcon />}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                  }}
                />
              )}
              
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h5" gutterBottom>
                  {plan.name}
                </Typography>
                
                <Typography variant="h4" color="primary" gutterBottom>
                  KES {plan.priceMonthly}/mo
                </Typography>
                
                {plan.description && (
                  <Typography color="text.secondary" paragraph>
                    {plan.description}
                  </Typography>
                )}

                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary={`${plan.maxSessionsPerWeek} sessions per week`} />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      {plan.canCreatePrivateTeams ? (
                        <CheckCircleIcon color="success" />
                      ) : (
                        <CancelIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText primary="Create premium teams" />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      {plan.hasPriorityBooking ? (
                        <CheckCircleIcon color="success" />
                      ) : (
                        <CancelIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText primary="Priority booking" />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      {plan.hasAdvancedAnalytics ? (
                        <CheckCircleIcon color="success" />
                      ) : (
                        <CancelIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText primary="Advanced analytics" />
                  </ListItem>
                </List>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  fullWidth
                  variant={userSubscription?.plan?.id === plan.id ? "outlined" : "contained"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={userSubscription?.plan?.id === plan.id}
                >
                  {userSubscription?.plan?.id === plan.id ? 'Current Plan' : 'Subscribe'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Payment Dialog */}
      {selectedPlan && (
        <PaymentDialog
          open={showPaymentDialog}
          onClose={() => {
            setShowPaymentDialog(false);
            setSelectedPlan(null);
            setPaymentDetails(null);
          }}
          onSubmit={handlePaymentSubmit}
          planName={selectedPlan.name}
          amount={Number(selectedPlan.priceMonthly)}
          loading={loading}
          paymentDetails={paymentDetails}
        />
      )}
    </Container>
  );
} 