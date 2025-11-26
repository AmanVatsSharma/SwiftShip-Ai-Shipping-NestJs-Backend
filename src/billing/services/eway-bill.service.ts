import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GstService } from './gst.service';
import { GenerateEwayBillInput } from '../dto/generate-eway-bill.input';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

/**
 * E-way Bill Service
 * 
 * Handles E-way bill generation and management for India.
 * 
 * E-way bill is required for:
 * - Inter-state movement of goods when value > ₹50,000
 * - Intra-state movement of goods when value > ₹50,000 (in some states)
 * 
 * Features:
 * - Generate E-way bill via GSTN API
 * - Track E-way bill status
 * - Cancel/update E-way bill
 * - Validate E-way bill
 * 
 * Flow:
 * 1. Validate shipment and invoice details
 * 2. Check if E-way bill is required (value > ₹50,000)
 * 3. Generate E-way bill via GSTN API
 * 4. Store E-way bill details
 * 5. Link to shipment
 */
@Injectable()
export class EwayBillService {
  private readonly logger = new Logger(EwayBillService.name);
  private readonly gstnApiUrl: string;
  private readonly gstnApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gstService: GstService,
    private readonly config: ConfigService,
  ) {
    // GSTN API configuration
    // In production, these should come from environment variables
    this.gstnApiUrl = this.config.get<string>('GSTN_API_URL') || 'https://ewaybillgst.gov.in';
    this.gstnApiKey = this.config.get<string>('GSTN_API_KEY') || '';
  }

  /**
   * Generate E-way bill number
   * Format: EWB-YYYYMMDD-XXXXXX
   */
  private generateEwayBillNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const datePrefix = `EWB-${year}${month}${day}`;
    const suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    return `${datePrefix}-${suffix}`;
  }

  /**
   * Check if E-way bill is required
   * 
   * E-way bill is required when:
   * - Invoice value > ₹50,000 (inter-state)
   * - Invoice value > ₹50,000 (intra-state, in some states)
   */
  isEwayBillRequired(invoiceValue: number, isInterState: boolean): boolean {
    const threshold = 50000; // ₹50,000
    return invoiceValue >= threshold;
  }

  /**
   * Generate E-way bill
   */
  async generateEwayBill(input: GenerateEwayBillInput) {
    console.log('[EwayBillService] generateEwayBill', { shipmentId: input.shipmentId });

    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: input.shipmentId },
      include: {
        order: true,
        carrier: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${input.shipmentId} not found`);
    }

    // Check if E-way bill already exists
    const existingEwayBill = await this.prisma.ewayBill.findUnique({
      where: { shipmentId: input.shipmentId },
    });

    if (existingEwayBill) {
      throw new BadRequestException('E-way bill already exists for this shipment');
    }

    // Validate GSTINs
    if (!this.gstService.validateGstin(input.consignorGstin)) {
      throw new BadRequestException('Invalid consignor GSTIN');
    }

    if (!this.gstService.validateGstin(input.consigneeGstin)) {
      throw new BadRequestException('Invalid consignee GSTIN');
    }

    // Check if E-way bill is required
    const isInterState = this.gstService.isInterState(
      input.consignorGstin,
      input.consigneeGstin,
    );

    if (!this.isEwayBillRequired(input.invoiceValue, isInterState)) {
      throw new BadRequestException(
        'E-way bill is not required for invoice value less than ₹50,000',
      );
    }

    // Generate E-way bill via GSTN API
    // In production, this should call the actual GSTN API
    // For now, we'll generate a mock E-way bill number
    const ewayBillNumber = await this.generateEwayBillFromGstn(input);

    // Calculate validity (E-way bill is valid for 1 day from generation)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);

    // Create E-way bill record
    const ewayBill = await this.prisma.ewayBill.create({
      data: {
        shipmentId: input.shipmentId,
        ewayBillNumber,
        consignorGstin: input.consignorGstin,
        consigneeGstin: input.consigneeGstin,
        placeOfDispatch: input.placeOfDispatch,
        placeOfDelivery: input.placeOfDelivery,
        invoiceValue: input.invoiceValue,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        hsnCode: input.hsnCode,
        reason: input.reason,
        transporterId: input.transporterId,
        vehicleNumber: input.vehicleNumber,
        status: 'ACTIVE',
        validUntil,
        metadata: {
          isInterState,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`E-way bill generated: ${ewayBillNumber}`, {
      shipmentId: input.shipmentId,
      ewayBillId: ewayBill.id,
    });

    return ewayBill;
  }

  /**
   * Generate E-way bill from GSTN API
   * 
   * In production, this should call the actual GSTN E-way bill API
   * For now, we'll generate a mock number
   */
  private async generateEwayBillFromGstn(input: GenerateEwayBillInput): Promise<string> {
    // TODO: Implement actual GSTN API integration
    // This is a placeholder that generates a mock E-way bill number
    
    if (!this.gstnApiKey) {
      this.logger.warn('GSTN API key not configured, generating mock E-way bill number');
      return this.generateEwayBillNumber();
    }

    try {
      // In production, make actual API call to GSTN
      // const response = await axios.post(`${this.gstnApiUrl}/api/ewaybill/generate`, {
      //   consignorGstin: input.consignorGstin,
      //   consigneeGstin: input.consigneeGstin,
      //   invoiceValue: input.invoiceValue,
      //   invoiceNumber: input.invoiceNumber,
      //   invoiceDate: input.invoiceDate,
      //   hsnCode: input.hsnCode,
      //   placeOfDispatch: input.placeOfDispatch,
      //   placeOfDelivery: input.placeOfDelivery,
      // }, {
      //   headers: {
      //     'Authorization': `Bearer ${this.gstnApiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      // });
      // return response.data.ewayBillNumber;

      // For now, return mock number
      return this.generateEwayBillNumber();
    } catch (error) {
      this.logger.error('Failed to generate E-way bill from GSTN API', error);
      throw new BadRequestException('Failed to generate E-way bill. Please try again.');
    }
  }

  /**
   * Get E-way bill by ID
   */
  async getEwayBill(id: number) {
    const ewayBill = await this.prisma.ewayBill.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            order: true,
            carrier: true,
          },
        },
      },
    });

    if (!ewayBill) {
      throw new NotFoundException(`E-way bill with ID ${id} not found`);
    }

    return ewayBill;
  }

  /**
   * Get E-way bill by shipment ID
   */
  async getEwayBillByShipment(shipmentId: number) {
    const ewayBill = await this.prisma.ewayBill.findUnique({
      where: { shipmentId },
      include: {
        shipment: {
          include: {
            order: true,
            carrier: true,
          },
        },
      },
    });

    if (!ewayBill) {
      throw new NotFoundException(`E-way bill for shipment ${shipmentId} not found`);
    }

    return ewayBill;
  }

  /**
   * Cancel E-way bill
   */
  async cancelEwayBill(id: number, reason?: string) {
    const ewayBill = await this.getEwayBill(id);

    if (ewayBill.status === 'CANCELLED') {
      throw new BadRequestException('E-way bill is already cancelled');
    }

    if (ewayBill.status === 'EXPIRED') {
      throw new BadRequestException('Cannot cancel an expired E-way bill');
    }

    // In production, call GSTN API to cancel
    // await this.cancelEwayBillInGstn(ewayBill.ewayBillNumber, reason);

    return this.prisma.ewayBill.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...(ewayBill.metadata as any),
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason,
        },
      },
    });
  }

  /**
   * Validate E-way bill
   */
  async validateEwayBill(ewayBillNumber: string): Promise<boolean> {
    const ewayBill = await this.prisma.ewayBill.findUnique({
      where: { ewayBillNumber },
    });

    if (!ewayBill) {
      return false;
    }

    // Check if expired
    if (ewayBill.validUntil && new Date() > ewayBill.validUntil) {
      return false;
    }

    // Check status
    if (ewayBill.status !== 'ACTIVE') {
      return false;
    }

    return true;
  }
}
