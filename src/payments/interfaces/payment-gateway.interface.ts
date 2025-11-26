/**
 * Payment Gateway Interface
 * 
 * Defines the contract for payment gateway implementations.
 * This abstraction allows switching between different payment providers
 * (Stripe, Razorpay, etc.) without changing business logic.
 * 
 * Flow:
 * 1. Create payment intent/order
 * 2. Process payment
 * 3. Verify payment
 * 4. Handle refunds
 * 5. Handle webhooks
 * 
 * Error Handling:
 * - All methods throw PaymentGatewayError on failures
 * - Gateway-specific errors are wrapped
 * - Comprehensive logging for debugging
 */
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  clientSecret?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  paymentId: string;
  status: 'succeeded' | 'failed' | 'pending';
  gatewayPaymentId: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  refundId: string;
  status: 'succeeded' | 'failed' | 'pending';
  gatewayRefundId: string;
  amount: number;
  metadata?: Record<string, any>;
}

export interface PaymentGateway {
  /**
   * Create a payment intent/order
   * @param amount - Amount in smallest currency unit (paise for INR, cents for USD)
   * @param currency - Currency code (INR, USD, etc.)
   * @param metadata - Additional metadata
   * @returns Payment intent with client secret or payment order details
   */
  createPaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentIntent>;

  /**
   * Verify payment status
   * @param paymentId - Gateway payment ID
   * @returns Payment result with status
   */
  verifyPayment(paymentId: string): Promise<PaymentResult>;

  /**
   * Process refund
   * @param paymentId - Gateway payment ID
   * @param amount - Refund amount (optional, full refund if not provided)
   * @param reason - Refund reason
   * @returns Refund result
   */
  refund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult>;

  /**
   * Verify webhook signature
   * @param payload - Webhook payload
   * @param signature - Webhook signature
   * @returns True if signature is valid
   */
  verifyWebhook(payload: string, signature: string): boolean;

  /**
   * Parse webhook event
   * @param payload - Webhook payload
   * @returns Parsed webhook event
   */
  parseWebhook(payload: any): {
    type: string;
    paymentId: string;
    status: string;
    metadata?: Record<string, any>;
  };
}

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly gateway: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}
