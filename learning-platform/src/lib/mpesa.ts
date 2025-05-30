import axios from 'axios';

interface MPESAConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
}

class MPESAClient {
  private config: MPESAConfig;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: MPESAConfig) {
    this.config = config;
    this.baseUrl = 'https://sandbox.safaricom.co.ke'; // Change to production URL in production
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      return this.accessToken;
    } catch (error) {
      console.error('Error getting M-PESA access token:', error);
      throw new Error('Failed to get M-PESA access token');
    }
  }

  public async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc: string
  ) {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(
      `${this.config.shortcode}${this.config.passkey}${timestamp}`
    ).toString('base64');

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.config.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: this.config.shortcode,
          PhoneNumber: phoneNumber,
          CallBackURL: this.config.callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error initiating STK push:', error);
      throw new Error('Failed to initiate M-PESA payment');
    }
  }

  public async checkTransactionStatus(checkoutRequestId: string) {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(
      `${this.config.shortcode}${this.config.passkey}${timestamp}`
    ).toString('base64');

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.config.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error checking transaction status:', error);
      throw new Error('Failed to check M-PESA transaction status');
    }
  }
}

// Create and export the M-PESA client instance
export const mpesa = new MPESAClient({
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  passkey: process.env.MPESA_PASSKEY || '',
  shortcode: process.env.MPESA_SHORTCODE || '',
  callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mpesa/callback` || '',
}); 