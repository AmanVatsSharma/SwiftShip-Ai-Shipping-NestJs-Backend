import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { PaymentGatewayError } from '../interfaces/payment-gateway.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment Service
 * 
 * Business logic layer for payment processing.
 * 
 * Features:
 * - Create payment intents
 * - Process payments
 * - Verify payments
 * - Process refunds
 * - Payment status management
 * 
 * Flow:
 * 1. Create payment intent via gateway
 * 2. Store payment record in database
 * 3. Process payment verification
 * 4. Update payment status
 * 5. Handle refunds
 * 
 * Error Handling:
 * - Validates payment data
 * - Handles gateway errors
 * - Updates payment status on failures
 * - Comprehensive logging
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayFactory: PaymentGatewayFactory,
  ) {}

  /**
   * Create a payment intent
   * @param userId - User ID
   * @param amount - Amount in major currency unit (e.g., 100.50 for INR)
   * @param currency - Currency code (INR, USD, etc.)
   * @param gateway - Payment gateway name (STRIPE, RAZORPAY)
   * @param orderId - Optional order ID
   * @param metadata - Additional metadata
   * @returns Payment intent with client secret
   */
  async createPaymentIntent(
    userId: number,
    amount: number,
    currency: string,
    gateway: 'STRIPE' | 'RAZORPAY',
    orderId?: number,
    metadata?: Record<string, any>
  ) {
    this.logger.log('Creating payment intent', {
      userId,
      amount,
      currency,
      gateway,
      orderId,
    });

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Validate order if provided
    if (orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (order.userId !== userId) {
        throw new BadRequestException('Order does not belong to user');
      }
    }

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    try {
      // Get gateway
      const paymentGateway = this.gatewayFactory.getGateway(gateway);

      // Create payment intent via gateway
      const paymentIntent = await paymentGateway.createPaymentIntent(
        amount,
        currency,
        {
          userId: userId.toString(),
          orderId: orderId?.toString(),
          ...metadata,
        }
      );

      // Create payment record in database
      const payment = await this.prisma.payment.create({
        data: {
          id: uuidv4(),
          userId,
          orderId: orderId || null,
          amount,
          currency: currency.toUpperCase(),
          status: this.mapIntentStatusToPaymentStatus(paymentIntent.status),
          gateway: gateway as any,
          gatewayPaymentId: paymentIntent.id,
          metadata: paymentIntent.metadata || {},
        },
      });

      this.logger.log('Payment intent created', {
        paymentId: payment.id,
        gatewayPaymentId: paymentIntent.id,
      });

      return {
        paymentId: payment.id,
        clientSecret: paymentIntent.clientSecret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: payment.status,
      };
    } catch (error) {
      this.logger.error('Failed to create payment intent', {
        userId,
        amount,
        gateway,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof PaymentGatewayError) {
        throw new BadRequestException(`Payment gateway error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Verify and update payment status
   * @param paymentId - Payment ID
   * @returns Updated payment record
   */
  async verifyPayment(paymentId: string) {
    this.logger.log('Verifying payment', { paymentId });

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    try {
      // Get gateway
      const paymentGateway = this.gatewayFactory.getGateway(payment.gateway);

      // Verify payment via gateway
      const result = await paymentGateway.verifyPayment(payment.gatewayPaymentId || '');

      // Update payment status
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: this.mapGatewayStatusToPaymentStatus(result.status),
          metadata: {
            ...(payment.metadata as Record<string, any> || {}),
            ...result.metadata,
            verifiedAt: new Date().toISOString(),
          },
        },
      });

      // Update order status if payment succeeded and order exists
      if (result.status === 'succeeded' && payment.orderId) {
        await this.prisma.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID' },
        });
      }

      this.logger.log('Payment verified', {
        paymentId,
        status: updatedPayment.status,
      });

      return updatedPayment;
    } catch (error) {
      this.logger.error('Failed to verify payment', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update payment with failure status
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Process refund
   * @param paymentId - Payment ID
   * @param amount - Refund amount (optional, full refund if not provided)
   * @param reason - Refund reason
   * @returns Refund record
   */
  async refund(
    paymentId: string,
    amount?: number,
    reason?: string
  ) {
    this.logger.log('Processing refund', {
      paymentId,
      amount,
      reason,
    });

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Only succeeded payments can be refunded');
    }

    // Calculate refund amount
    const refundAmount = amount || (payment.amount - payment.refundedAmount);
    const remainingAmount = payment.amount - payment.refundedAmount;

    if (refundAmount > remainingAmount) {
      throw new BadRequestException(`Refund amount (${refundAmount}) exceeds remaining amount (${remainingAmount})`);
    }

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    try {
      // Get gateway
      const paymentGateway = this.gatewayFactory.getGateway(payment.gateway);

      // Process refund via gateway
      const refundResult = await paymentGateway.refund(
        payment.gatewayPaymentId || '',
        refundAmount,
        reason
      );

      // Create refund record
      const refund = await this.prisma.refund.create({
        data: {
          id: uuidv4(),
          paymentId: payment.id,
          amount: refundAmount,
          currency: payment.currency,
          gatewayRefundId: refundResult.gatewayRefundId,
          reason: reason || null,
          status: this.mapGatewayStatusToPaymentStatus(refundResult.status),
          metadata: refundResult.metadata || {},
        },
      });

      // Update payment refunded amount and status
      const newRefundedAmount = payment.refundedAmount + refundAmount;
      const newStatus = newRefundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          refundedAmount: newRefundedAmount,
          status: newStatus,
        },
      });

      // Update order status if fully refunded
      if (newStatus === 'REFUNDED' && payment.orderId) {
        await this.prisma.order.update({
          where: { id: payment.orderId },
          data: { status: 'REFUNDED' },
        });
      }

      this.logger.log('Refund processed', {
        refundId: refund.id,
        amount: refundAmount,
        paymentId,
      });

      return refund;
    } catch (error) {
      this.logger.error('Failed to process refund', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
          },
        },
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    return payment;
  }

  /**
   * Get payments by user ID
   */
  async getPaymentsByUser(userId: number) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get payments by order ID
   */
  async getPaymentsByOrder(orderId: number) {
    return this.prisma.payment.findMany({
      where: { orderId },
      include: {
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private mapIntentStatusToPaymentStatus(status: string): any {
    switch (status) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'processing':
        return 'PROCESSING';
      case 'pending':
        return 'PENDING';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  private mapGatewayStatusToPaymentStatus(status: string): any {
    switch (status) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'failed':
        return 'FAILED';
      case 'pending':
        return 'PENDING';
      default:
        return 'PENDING';
    }
  }
}
