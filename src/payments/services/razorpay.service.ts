import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import {
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  RefundResult,
  PaymentGatewayError,
} from '../interfaces/payment-gateway.interface';
import crypto from 'crypto';

/**
 * Razorpay Payment Gateway Service
 * 
 * Implements Razorpay payment gateway integration for Indian market.
 * 
 * Features:
 * - Payment order creation
 * - Payment verification
 * - Refund processing
 * - Webhook handling
 * 
 * Configuration:
 * - RAZORPAY_KEY_ID: Razorpay key ID
 * - RAZORPAY_KEY_SECRET: Razorpay key secret
 * - RAZORPAY_WEBHOOK_SECRET: Webhook secret for signature verification
 * 
 * Error Handling:
 * - Wraps Razorpay errors in PaymentGatewayError
 * - Comprehensive logging
 * - Signature verification for webhooks
 */
@Injectable()
export class RazorpayService implements PaymentGateway {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly razorpay: Razorpay;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';

    this.logger.log('Razorpay service initialized', {
      hasKeyId: !!keyId,
      hasKeySecret: !!keySecret,
      hasWebhookSecret: !!this.webhookSecret,
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    this.logger.log('Creating Razorpay payment order', {
      amount,
      currency,
      hasMetadata: !!metadata,
    });

    try {
      // Razorpay uses paise for INR (smallest currency unit)
      const amountInPaise = Math.round(Number(amount) * 100);

      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: currency.toUpperCase(),
        receipt: metadata?.receipt || `receipt_${Date.now()}`,
        notes: metadata || {},
      });

      this.logger.log('Razorpay payment order created', {
        orderId: order.id,
        status: order.status,
      });

      return {
        id: order.id,
        amount: Number(order.amount) / 100, // Convert back to major currency unit
        currency: order.currency,
        status: this.mapRazorpayOrderStatus(order.status),
        clientSecret: order.id, // Razorpay uses order ID as client secret equivalent
        metadata: (order.notes as Record<string, any>) || {},
      };
    } catch (error: any) {
      this.logger.error('Failed to create Razorpay payment order', {
        error: error?.error?.description || error?.message || 'Unknown error',
        amount,
        currency,
      });

      throw new PaymentGatewayError(
        error?.error?.description || error?.message || 'Failed to create payment order',
        error?.error?.code || 'RAZORPAY_ERROR',
        'RAZORPAY',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentResult> {
    this.logger.log('Verifying Razorpay payment', { paymentId });

    try {
      const payment = await this.razorpay.payments.fetch(paymentId);

      this.logger.log('Razorpay payment verified', {
        paymentId,
        status: payment.status,
      });

      return {
        paymentId: payment.id,
        status: this.mapRazorpayPaymentStatus(payment.status),
        gatewayPaymentId: payment.id,
        metadata: payment.notes as Record<string, any>,
      };
    } catch (error: any) {
      this.logger.error('Failed to verify Razorpay payment', {
        paymentId,
        error: error?.error?.description || error?.message || 'Unknown error',
      });

      throw new PaymentGatewayError(
        error?.error?.description || error?.message || 'Failed to verify payment',
        error?.error?.code || 'RAZORPAY_ERROR',
        'RAZORPAY',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  async refund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult> {
    this.logger.log('Processing Razorpay refund', {
      paymentId,
      amount,
      reason,
    });

    try {
      const refundParams: any = {
        payment_id: paymentId,
        ...(amount && { amount: Math.round(amount * 100) }), // Convert to paise
        ...(reason && { notes: { reason } }),
      };

      const refund = await this.razorpay.payments.refund(paymentId, refundParams);

      this.logger.log('Razorpay refund processed', {
        refundId: refund.id,
        amount: (refund.amount || 0) / 100,
        status: refund.status,
      });

      return {
        refundId: refund.id,
        status: this.mapRazorpayRefundStatus(refund.status),
        gatewayRefundId: refund.id,
        amount: (refund.amount || 0) / 100, // Convert back to major currency unit
        metadata: (refund.notes as Record<string, any>) || {},
      };
    } catch (error: any) {
      this.logger.error('Failed to process Razorpay refund', {
        paymentId,
        error: error?.error?.description || error?.message || 'Unknown error',
      });

      throw new PaymentGatewayError(
        error?.error?.description || error?.message || 'Failed to process refund',
        error?.error?.code || 'RAZORPAY_ERROR',
        'RAZORPAY',
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
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        this.logger.error('Webhook signature mismatch');
      }

      return isValid;
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
    const event = payload.event;
    const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity;

    let paymentId = '';
    let status = '';

    if (event === 'payment.captured' || event === 'payment.authorized') {
      paymentId = entity?.id || '';
      status = 'succeeded';
    } else if (event === 'payment.failed') {
      paymentId = entity?.id || '';
      status = 'failed';
    } else if (event === 'refund.created' || event === 'refund.processed') {
      paymentId = entity?.payment_id || '';
      status = 'refunded';
    }

    return {
      type: event,
      paymentId,
      status,
      metadata: entity?.notes as Record<string, any>,
    };
  }

  private mapRazorpayOrderStatus(status: string): PaymentIntent['status'] {
    switch (status) {
      case 'paid':
        return 'succeeded';
      case 'attempted':
        return 'processing';
      case 'created':
        return 'pending';
      default:
        return 'pending';
    }
  }

  private mapRazorpayPaymentStatus(status: string): 'succeeded' | 'failed' | 'pending' {
    switch (status) {
      case 'captured':
      case 'authorized':
        return 'succeeded';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private mapRazorpayRefundStatus(status: string): RefundResult['status'] {
    switch (status) {
      case 'processed':
        return 'succeeded';
      case 'pending':
        return 'pending';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
