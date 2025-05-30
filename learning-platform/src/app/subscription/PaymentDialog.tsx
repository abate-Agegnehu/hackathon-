import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import { useState } from 'react';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (phoneNumber: string) => Promise<void>;
  planName: string;
  amount: number;
  loading?: boolean;
  paymentDetails?: {
    status: string;
    amount: number;
    currency: string;
  } | null;
}

export default function PaymentDialog({
  open,
  onClose,
  onSubmit,
  planName,
  amount,
  loading = false,
  paymentDetails
}: PaymentDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Validate phone number
    const phoneRegex = /^(?:254|\+254|0)?([71](?:(?:0[0-8])|(?:[12][0-9])|(?:9[0-9])|(?:4[0-36])|(?:5[0-9])|(?:6[0-9])|(?:7[0-9])|(?:8[0-9]))[0-9]{6})$/;
    if (!phoneRegex.test(phoneNumber)) {
      setError('Please enter a valid Kenyan phone number');
      return;
    }

    try {
      await onSubmit(phoneNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Subscribe to {planName}</DialogTitle>
      <DialogContent>
        {paymentDetails ? (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Payment Status: {paymentDetails.status}
            </Typography>
            <Typography>
              Amount: {paymentDetails.amount} {paymentDetails.currency}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Please complete the payment on your phone when prompted.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography gutterBottom>
              Amount to pay: {amount} KES
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              label="Phone Number"
              type="tel"
              fullWidth
              variant="outlined"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setError(null);
              }}
              error={!!error}
              helperText={error || 'Enter your M-PESA number (e.g., 0712345678)'}
              disabled={loading}
              placeholder="0712345678"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {!paymentDetails && (
          <Button
            onClick={handleSubmit}
            disabled={loading || !phoneNumber}
            variant="contained"
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : (
              'Pay with M-PESA'
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
} 