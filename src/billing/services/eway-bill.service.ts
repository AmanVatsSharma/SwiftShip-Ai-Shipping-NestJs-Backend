import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GstService } from './gst.service';
import { GenerateEwayBillInput } from '../dto/generate-eway-bill.input';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../storage/storage.service';
import { createHmac } from 'crypto';
import { InvoiceEmailWorker } from './invoice-email.worker';
import { Prisma } from '@prisma/client';

interface GstnEwayBillResponse {
  ewayBillNumber: string;
  ackNumber: string;
  ackDate: string;
  validUntil: string;
  signedPayload: string;
  signatureValid: boolean;
  documentBase64?: string;
}

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: { sellerProfile: true; warehouse: true; invoiceItems: true };
}>;

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
  private readonly gstnClientId: string | null;
  private readonly gstnClientSecret: string | null;
  private readonly gstnSignatureSecret: string | null;
  private readonly gstnRetryAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gstService: GstService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly invoiceEmailWorker: InvoiceEmailWorker,
  ) {
    // GSTN API configuration
    // In production, these should come from environment variables
    this.gstnApiUrl = this.config.get<string>('GSTN_API_URL') || 'https://ewaybillgst.gov.in';
    this.gstnApiKey = this.config.get<string>('GSTN_API_KEY') || '';
    this.gstnClientId = this.config.get<string>('GSTN_CLIENT_ID') || null;
    this.gstnClientSecret = this.config.get<string>('GSTN_CLIENT_SECRET') || null;
    this.gstnSignatureSecret = this.config.get<string>('GSTN_SIGNATURE_SECRET') || null;
    this.gstnRetryAttempts = Number(this.config.get<string>('GSTN_RETRY_ATTEMPTS') || 3);
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
        warehouse: true,
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

    // Load invoice if provided
    let invoice: InvoiceWithRelations | null = null;
    if (input.invoiceId) {
      invoice = await this.prisma.invoice.findUnique({
        where: { id: input.invoiceId },
        include: { sellerProfile: true, warehouse: true, invoiceItems: true },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${input.invoiceId} not found`);
      }
      input.invoiceNumber = invoice.invoiceNumber;
      input.invoiceDate = invoice.createdAt;
      input.invoiceValue = invoice.totalAmount;
      input.consignorGstin = invoice.sellerProfile?.gstin || input.consignorGstin;
      input.consigneeGstin = input.consigneeGstin || invoice.buyerGstin || input.consigneeGstin;
      input.placeOfDispatch =
        input.placeOfDispatch ||
        [invoice.warehouse?.city, invoice.warehouse?.state].filter(Boolean).join(', ');
      input.placeOfDelivery =
        input.placeOfDelivery ||
        [
          shipment.order?.destinationCity,
          shipment.order?.destinationState,
          shipment.order?.destinationPincode,
        ]
          .filter(Boolean)
          .join(', ');
      input.hsnCode =
        input.hsnCode || invoice.invoiceItems?.[0]?.hsnCode || input.hsnCode || '996511';
    }

    // Validate GSTINs
    if (!input.consignorGstin) {
      throw new BadRequestException('Consignor GSTIN is required');
    }

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

    if (!input.invoiceValue) {
      throw new BadRequestException('Invoice value is required for e-way bill generation');
    }

    const invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : new Date();

    const gstnPayload = {
      consignorGstin: input.consignorGstin,
      consigneeGstin: input.consigneeGstin,
      placeOfDispatch: input.placeOfDispatch,
      placeOfDelivery: input.placeOfDelivery,
      invoiceValue: input.invoiceValue,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: invoiceDate.toISOString().split('T')[0],
      hsnCode: input.hsnCode,
      reason: input.reason,
      transporterId: input.transporterId,
      vehicleNumber: input.vehicleNumber,
      isInterState,
    };

    const gstnResponse = await this.generateEwayBillFromGstn(gstnPayload);

    const validUntil = new Date(gstnResponse.validUntil);

    const documentUpload = gstnResponse.documentBase64
      ? await this.uploadEwayBillDocument(
          gstnResponse.documentBase64,
          `eway-bills/${gstnResponse.ewayBillNumber}.pdf`,
        )
      : null;

    // Create E-way bill record
    const ewayBill = await this.prisma.ewayBill.create({
      data: {
        shipmentId: input.shipmentId,
        invoiceId: invoice?.id,
        ewayBillNumber: gstnResponse.ewayBillNumber,
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
        ackNumber: gstnResponse.ackNumber,
        ackDate: new Date(gstnResponse.ackDate),
        signedPayload: gstnResponse.signedPayload,
        signatureValidated: gstnResponse.signatureValid,
        documentStorageKey: documentUpload?.key || null,
        ewayBillUrl: documentUpload?.url,
        retryCount: 0,
        lastSyncAttempt: new Date(),
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        metadata: {
          isInterState,
          generatedAt: new Date().toISOString(),
          gstnPayload,
        },
      },
    });

    if (invoice && invoice.emailDeliveryStatus === 'PENDING' && invoice.buyerEmail) {
      this.invoiceEmailWorker.enqueue(invoice.id).catch((error) => {
        this.logger.error('Failed to enqueue invoice email after e-way bill', {
          invoiceId: invoice?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }

    this.logger.log(`E-way bill generated: ${gstnResponse.ewayBillNumber}`, {
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
  private async generateEwayBillFromGstn(payload: Record<string, any>): Promise<GstnEwayBillResponse> {
    if (!this.gstnApiKey || !this.gstnClientId || !this.gstnClientSecret) {
      this.logger.warn('GSTN credentials missing, using mock E-way bill response');
      return this.mockGstnResponse(payload);
    }

    let attempt = 0;
    let lastError: any;

    while (attempt < this.gstnRetryAttempts) {
      attempt += 1;
      try {
        const response = await axios.post(
          `${this.gstnApiUrl}/api/ewaybill/generate`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${this.gstnApiKey}`,
              'x-client-id': this.gstnClientId,
              'x-client-secret': this.gstnClientSecret,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          },
        );

        const data = response.data?.data || response.data;
        const signedPayload = JSON.stringify(data.payload || data);
        const signatureHeader = response.headers['x-gst-signature'] || data.signature;
        const signatureValid = this.verifySignature(signedPayload, signatureHeader);

        return {
          ewayBillNumber: data.ewayBillNumber || data.ewaybillNo,
          ackNumber: data.ackNumber || data.ackNo || this.generateAckNumber(),
          ackDate: data.ackDate || data.ackDt || new Date().toISOString(),
          validUntil: data.validUntil || data.validUpto || this.buildValidityWindow(),
          signedPayload,
          signatureValid,
          documentBase64: data.documentBase64 || data.pdfBase64,
        };
      } catch (error) {
        lastError = error;
        this.logger.error('GSTN E-way bill generation failed', {
          attempt,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    throw new BadRequestException(
      lastError instanceof Error ? lastError.message : 'Failed to generate E-way bill. Please try again.',
    );
  }

  private verifySignature(payload: string, signature?: string): boolean {
    if (!this.gstnSignatureSecret || !signature) {
      return false;
    }

    const expected = createHmac('sha256', this.gstnSignatureSecret).update(payload).digest('hex');
    if (expected !== signature) {
      throw new BadRequestException('GSTN response signature verification failed');
    }
    return true;
  }

  private mockGstnResponse(payload: Record<string, any>): GstnEwayBillResponse {
    const ewayBillNumber = this.generateEwayBillNumber();
    const now = new Date();
    const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return {
      ewayBillNumber,
      ackNumber: this.generateAckNumber(),
      ackDate: now.toISOString(),
      validUntil: validUntil.toISOString(),
      signedPayload: JSON.stringify(payload),
      signatureValid: false,
    };
  }

  private generateAckNumber(): string {
    return `ACK-${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`;
  }

  private buildValidityWindow(): string {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);
    return validUntil.toISOString();
  }

  private async uploadEwayBillDocument(base64: string, key: string) {
    const buffer = Buffer.from(base64, 'base64');
    const result = await this.storage.uploadBuffer(key, buffer, 'application/pdf', {
      cacheControl: 'private, max-age=0',
    });
    return { key, url: result.url };
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
