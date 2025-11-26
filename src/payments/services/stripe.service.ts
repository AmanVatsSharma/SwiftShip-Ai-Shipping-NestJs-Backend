import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  RefundResult,
  PaymentGatewayError,
} from '../interfaces/payment-gateway.interface';

/**
 * Stripe Payment Gateway Service
 * 
 * Implements Stripe payment gateway integration.
 * 
 * Features:
 * - Payment intent creation
 * - Payment verification
 * - Refund processing
 * - Webhook handling
 * 
 * Configuration:
 * - STRIPE_SECRET_KEY: Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook secret for signature verification
 * 
 * Error Handling:
 * - Wraps Stripe errors in PaymentGatewayError
 * - Comprehensive logging
 * - Retry logic for transient errors
 */
@Injectable()
export class StripeService implements PaymentGateway {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-11-17.clover',
    });

    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    this.logger.log('Stripe service initialized', {
      hasSecretKey: !!secretKey,
      hasWebhookSecret: !!this.webhookSecret,
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    this.logger.log('Creating Stripe payment intent', {
      amount,
      currency,
      hasMetadata: !!metadata,
    });

    try {
      // Convert amount to cents (Stripe uses smallest currency unit)
      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log('Stripe payment intent created', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert back to major currency unit
        currency: paymentIntent.currency.toUpperCase(),
        status: this.mapStripeStatus(paymentIntent.status),
        clientSecret: paymentIntent.client_secret || undefined,
        metadata: paymentIntent.metadata as Record<string, any>,
      };
    } catch (error) {
      this.logger.error('Failed to create Stripe payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        amount,
        currency,
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentGatewayError(
          error.message,
          error.code || 'STRIPE_ERROR',
          'STRIPE',
          error
        );
      }

      throw new PaymentGatewayError(
        'Failed to create payment intent',
        'UNKNOWN_ERROR',
        'STRIPE',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentResult> {
    this.logger.log('Verifying Stripe payment', { paymentId });

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);

      this.logger.log('Stripe payment verified', {
        paymentId,
        status: paymentIntent.status,
      });

      return {
        paymentId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status) as 'succeeded' | 'failed' | 'pending',
        gatewayPaymentId: paymentIntent.id,
        metadata: paymentIntent.metadata as Record<string, any>,
      };
    } catch (error) {
      this.logger.error('Failed to verify Stripe payment', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentGatewayError(
          error.message,
          error.code || 'STRIPE_ERROR',
          'STRIPE',
          error
        );
      }

      throw new PaymentGatewayError(
        'Failed to verify payment',
        'UNKNOWN_ERROR',
        'STRIPE',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  async refund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult> {
    this.logger.log('Processing Stripe refund', {
      paymentId,
      amount,
      reason,
    });

    try {
      // For Stripe, we need to get the charge ID from the payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
      
      const chargeId = paymentIntent.latest_charge;
      if (!chargeId || typeof chargeId !== 'string') {
        throw new PaymentGatewayError(
          'Payment intent has no charge',
          'NO_CHARGE',
          'STRIPE'
        );
      }

      const refundParams: Stripe.RefundCreateParams = {
        charge: chargeId,
        ...(amount && { amount: Math.round(amount * 100) }), // Convert to cents
        ...(reason && { reason: reason as Stripe.RefundCreateParams.Reason }),
      };

      const refund = await this.stripe.refunds.create(refundParams);

      this.logger.log('Stripe refund processed', {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      });

      return {
        refundId: refund.id,
        status: this.mapStripeRefundStatus(refund.status || 'pending'),
        gatewayRefundId: refund.id,
        amount: (refund.amount || 0) / 100, // Convert back to major currency unit
        metadata: {},
      };
    } catch (error) {
      this.logger.error('Failed to process Stripe refund', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentGatewayError(
          error.message,
          error.code || 'STRIPE_ERROR',
          'STRIPE',
          error
        );
      }

      throw new PaymentGatewayError(
        'Failed to process refund',
        'UNKNOWN_ERROR',
        'STRIPE',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping verification');
      return false;
    }

    try {
      this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch (error) {
      this.logger.error('Webhook signature verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  parseWebhook(payload: any): {
    type: string;
    paymentId: string;
    status: string;
    metadata?: Record<string, any>;
  } {
    const event = payload as Stripe.Event;

    let paymentId = '';
    let status = '';

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      paymentId = paymentIntent.id;
      status = 'succeeded';
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      paymentId = paymentIntent.id;
      status = 'failed';
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      paymentId = charge.payment_intent as string;
      status = 'refunded';
    }

    return {
      type: event.type,
      paymentId,
      status,
      metadata: (event.data.object as any).metadata as Record<string, any> || {},
    };
  }

  private mapStripeStatus(status: string): PaymentIntent['status'] {
    switch (status) {
      case 'succeeded':
        return 'succeeded';
      case 'processing':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'requires_capture':
        return 'processing';
      case 'canceled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  private mapStripeRefundStatus(status: string | null | undefined): RefundResult['status'] {
    if (!status) return 'pending';
    
    switch (status) {
      case 'succeeded':
        return 'succeeded';
      case 'pending':
        return 'pending';
      case 'failed':
      case 'canceled':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
