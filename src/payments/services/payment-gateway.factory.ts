import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';

/**
 * Payment Gateway Factory
 * 
 * Creates and manages payment gateway instances.
 * 
 * Flow:
 * 1. Factory creates gateway instances based on configuration
 * 2. Provides getGateway() method to retrieve gateway by name
 * 3. Supports multiple gateways simultaneously
 * 
 * Supported Gateways:
 * - STRIPE: Stripe payment gateway
 * - RAZORPAY: Razorpay payment gateway (Indian market)
 * 
 * Configuration:
 * - Default gateway can be set via PAYMENT_DEFAULT_GATEWAY
 * - Gateways are initialized only if credentials are provided
 */
@Injectable()
export class PaymentGatewayFactory {
  private readonly gateways: Map<string, PaymentGateway> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly stripeService: StripeService,
    private readonly razorpayService: RazorpayService,
  ) {
    this.initializeGateways();
  }

  private initializeGateways(): void {
    console.log('[PaymentGatewayFactory] Initializing payment gateways...');

    // Initialize Stripe if credentials are available
    try {
      const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
      if (stripeKey) {
        this.gateways.set('STRIPE', this.stripeService);
        console.log('[PaymentGatewayFactory] STRIPE gateway registered');
      } else {
        console.warn('[PaymentGatewayFactory] STRIPE_SECRET_KEY not configured, skipping Stripe');
      }
    } catch (error) {
      console.error('[PaymentGatewayFactory] Failed to initialize Stripe', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Initialize Razorpay if credentials are available
    try {
      const razorpayKeyId = this.config.get<string>('RAZORPAY_KEY_ID');
      const razorpayKeySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
      if (razorpayKeyId && razorpayKeySecret) {
        this.gateways.set('RAZORPAY', this.razorpayService);
        console.log('[PaymentGatewayFactory] RAZORPAY gateway registered');
      } else {
        console.warn('[PaymentGatewayFactory] RAZORPAY credentials not configured, skipping Razorpay');
      }
    } catch (error) {
      console.error('[PaymentGatewayFactory] Failed to initialize Razorpay', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    console.log(`[PaymentGatewayFactory] Initialization complete. Registered ${this.gateways.size} gateway(s)`, {
      gateways: Array.from(this.gateways.keys()),
    });
  }

  /**
   * Get a payment gateway by name
   * @param gatewayName - Gateway name (STRIPE, RAZORPAY)
   * @returns Payment gateway instance
   * @throws Error if gateway is not found
   */
  getGateway(gatewayName: string): PaymentGateway {
    const gateway = this.gateways.get(gatewayName.toUpperCase());
    if (!gateway) {
      throw new Error(`Payment gateway '${gatewayName}' is not available. Available gateways: ${Array.from(this.gateways.keys()).join(', ')}`);
    }
    return gateway;
  }

  /**
   * Get the default payment gateway
   * @returns Default payment gateway instance
   */
  getDefaultGateway(): PaymentGateway {
    const defaultGatewayName = this.config.get<string>('PAYMENT_DEFAULT_GATEWAY', 'RAZORPAY');
    return this.getGateway(defaultGatewayName);
  }

  /**
   * Get all available gateways
   * @returns Array of gateway names
   */
  getAvailableGateways(): string[] {
    return Array.from(this.gateways.keys());
  }
}
