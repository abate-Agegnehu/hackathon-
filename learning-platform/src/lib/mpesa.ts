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
    // Validate config
    if (!config.consumerKey || !config.consumerSecret || !config.passkey || !config.shortcode) {
      console.error('Missing M-PESA configuration:', {
        hasConsumerKey: !!config.consumerKey,
        hasConsumerSecret: !!config.consumerSecret,
        hasPasskey: !!config.passkey,
        hasShortcode: !!config.shortcode,
        hasCallbackUrl: !!config.callbackUrl
      });
      throw new Error('Invalid M-PESA configuration');
    }
    
    this.config = config;
    this.baseUrl = 'https://sandbox.safaricom.co.ke';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    try {
      console.log('Getting M-PESA access token...');
      
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      console.log('M-PESA access token response:', response.data);

      if (!response.data.access_token) {
        console.error('Invalid access token response:', response.data);
        throw new Error('Failed to get valid access token');
      }

      const token = response.data.access_token as string;
      this.accessToken = token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      return token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('M-PESA access token error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          config: {
            url: error.config?.url,
            headers: error.config?.headers
          }
        });
      } else {
        console.error('M-PESA access token error:', error);
      }
      throw new Error('Failed to get M-PESA access token: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any spaces or special characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Ensure it starts with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1);
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    // Ensure it's exactly 12 digits (254 + 9 digits)
    if (cleaned.length !== 12) {
      throw new Error('Invalid phone number format. Must be 12 digits including 254 prefix.');
    }
    
    return cleaned;
  }

  public async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc: string
  ) {
    try {
      console.log('Initiating STK push with:', {
        phoneNumber,
        amount,
        accountReference,
        transactionDesc
      });

      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = Buffer.from(
        `${this.config.shortcode}${this.config.passkey}${timestamp}`
      ).toString('base64');

      // Ensure shortcode is padded to 6 digits
      const paddedShortcode = this.config.shortcode.padStart(6, '0');

      const payload = {
        BusinessShortCode: paddedShortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(amount),
        PartyA: phoneNumber,
        PartyB: paddedShortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: this.config.callbackUrl,
        AccountReference: accountReference.substring(0, 12),
        TransactionDesc: transactionDesc.substring(0, 13)
      };

      console.log('STK push request payload:', {
        ...payload,
        Password: '***' // Hide password in logs
      });

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
        }
      );

      console.log('STK push response:', response.data);

      if (!response.data.CheckoutRequestID) {
        console.error('Invalid STK push response:', response.data);
        throw new Error('Failed to get valid CheckoutRequestID');
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('M-PESA STK push error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: {
              ...error.config?.headers,
              Authorization: '***' // Hide token in logs
            },
            data: error.config?.data
          }
        });
      } else {
        console.error('M-PESA STK push error:', error);
      }
      throw new Error('Failed to initiate M-PESA payment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public async checkTransactionStatus(checkoutRequestId: string) {
    try {
      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, 14); // Format: YYYYMMDDHHmmss
      
      // Generate password as per M-PESA documentation
      const password = Buffer.from(
        `${this.config.shortcode}${this.config.passkey}${timestamp}`
      ).toString('base64');

      // Ensure shortcode is padded to 6 digits
      const paddedShortcode = this.config.shortcode.padStart(6, '0');

      const payload = {
        BusinessShortCode: paddedShortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      console.log('Transaction status request payload:', {
        ...payload,
        Password: '***' // Hide password in logs
      });

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('Transaction status response:', response.data);

      // Parse and validate the response
      const { ResultCode, ResultDesc, MerchantRequestID, CheckoutRequestID } = response.data;
      
      return {
        success: ResultCode === "0",
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('M-PESA transaction status error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: {
              ...error.config?.headers,
              Authorization: '***' // Hide token in logs
            }
          }
        });
      } else {
        console.error('M-PESA transaction status error:', error);
      }
      throw new Error('Failed to check M-PESA transaction status: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

// Create and export the M-PESA client instance
const mpesaConfig = {
  // Sandbox credentials from the Safaricom Developer Portal
  consumerKey: process.env.MPESA_CONSUMER_KEY || 'w6NV89Vs0pPwr4HlVm2qEHA7WpQpzYvZGLgFAgnuUu09neKI',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'BrdpLAOrLMhdibzI0r5HRnEBtg8AAN93HRGoA5DSZN9ad9OpAWAzMujpGoaHpyl',
  passkey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  shortcode: process.env.MPESA_SHORTCODE || '174379',
  callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/payments/mpesa/callback`
};

console.log('Initializing M-PESA client with config:', {
  hasConsumerKey: !!mpesaConfig.consumerKey,
  hasConsumerSecret: !!mpesaConfig.consumerSecret,
  hasPasskey: !!mpesaConfig.passkey,
  shortcode: mpesaConfig.shortcode,
  callbackUrl: mpesaConfig.callbackUrl
});

export const mpesa = new MPESAClient(mpesaConfig); 