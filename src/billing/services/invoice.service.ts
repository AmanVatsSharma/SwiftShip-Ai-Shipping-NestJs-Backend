import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GstService } from './gst.service';
import { PdfService } from './pdf.service';
import { CreateInvoiceInput } from '../dto/create-invoice.input';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../../storage/storage.service';
import { InvoiceEmailWorker } from './invoice-email.worker';

interface BuyerDetails {
  name: string;
  gstin?: string;
  state?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  pincode?: string;
  country?: string;
}

/**
 * Invoice Service
 * 
 * Handles invoice generation, management, and PDF creation.
 * 
 * Features:
 * - Create invoices with GST calculation
 * - Generate invoice PDFs
 * - Manage invoice status
 * - Support for subscription and one-time invoices
 * 
 * Flow:
 * 1. Create invoice with items
 * 2. Calculate GST (CGST+SGST for intra-state, IGST for inter-state)
 * 3. Generate invoice number
 * 4. Store invoice in database
 * 5. Generate PDF
 * 6. Update invoice with PDF URL
 */
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gstService: GstService,
    private readonly pdfService: PdfService,
    private readonly storage: StorageService,
    private readonly invoiceEmailWorker: InvoiceEmailWorker,
  ) {}

  /**
   * Generate sequential invoice number scoped to warehouse + financial year.
   * Format: {WAREHOUSE_CODE}-FY{YY}-{YY}-{SEQUENCE}
   */
  private async generateSequentialInvoiceNumber(
    warehouseId: number,
    warehouseCode: string,
  ): Promise<{ invoiceNumber: string; sequenceNumber: number; financialYear: string }> {
    const now = new Date();
    const financialYear = this.getFinancialYear(now);
    const normalizedCode = warehouseCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const sequenceNumber = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.invoiceSequence.findUnique({
        where: {
          warehouseId_financialYear: {
            warehouseId,
            financialYear,
          },
        },
      });

      if (existing) {
        const updated = await tx.invoiceSequence.update({
          where: {
            warehouseId_financialYear: {
              warehouseId,
              financialYear,
            },
          },
          data: {
            lastSequence: { increment: 1 },
          },
        });
        return updated.lastSequence;
      }

      const created = await tx.invoiceSequence.create({
        data: {
          warehouseId,
          financialYear,
          lastSequence: 1,
          prefix: normalizedCode,
        },
      });
      return created.lastSequence;
    });

    const paddedSequence = String(sequenceNumber).padStart(6, '0');
    const invoiceNumber = `${normalizedCode}-FY${financialYear.replace('-', '')}-${paddedSequence}`;

    return { invoiceNumber, sequenceNumber, financialYear };
  }

  private getFinancialYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const fyStartYear = month >= 3 ? year : year - 1; // FY starts in April
    const fyEndYear = fyStartYear + 1;
    return `${String(fyStartYear).slice(-2)}-${String(fyEndYear).slice(-2)}`;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput) {
    console.log('[InvoiceService] createInvoice', {
      userId: input.userId,
      warehouseId: input.warehouseId,
      itemCount: input.items.length,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${input.userId} not found`);
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${input.warehouseId} not found`);
    }

    if (input.subscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: input.subscriptionId },
      });
      if (!subscription) {
        throw new NotFoundException(`Subscription with ID ${input.subscriptionId} not found`);
      }
    }

    const sellerProfile = await this.fetchSellerProfile(warehouse.id, input.sellerProfileId);
    const buyer = this.resolveBuyerDetails(input, user);
    const isInterState = this.determineInterState(
      sellerProfile.gstin,
      sellerProfile.state,
      buyer,
    );

    const lineItems = input.items.map((item) => {
      const totalPrice = item.unitPrice * item.quantity;
      const taxRate = item.taxRate || 0;
      const gstBreakup = this.gstService.calculateGst(totalPrice, taxRate, isInterState);

      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        hsnCode: item.hsnCode,
        taxRate,
        taxAmount: gstBreakup.totalTax,
        cgstAmount: gstBreakup.cgst,
        sgstAmount: gstBreakup.sgst,
        igstAmount: gstBreakup.igst,
        gstType: gstBreakup.gstType,
      };
    });

    const amount = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const cgstAmount = lineItems.reduce((sum, item) => sum + item.cgstAmount, 0);
    const sgstAmount = lineItems.reduce((sum, item) => sum + item.sgstAmount, 0);
    const igstAmount = lineItems.reduce((sum, item) => sum + item.igstAmount, 0);
    const totalAmount = amount + taxAmount;

    const { invoiceNumber, sequenceNumber, financialYear } =
      await this.generateSequentialInvoiceNumber(warehouse.id, warehouse.code);

    const emailDeliveryStatus =
      input.autoEmailBuyer === false || !buyer.email ? 'SKIPPED' : 'PENDING';

    const invoice = await this.prisma.invoice.create({
      data: {
        id: uuidv4(),
        invoiceNumber,
        sequenceNumber,
        financialYear,
        userId: input.userId,
        warehouseId: warehouse.id,
        sellerProfileId: sellerProfile.id,
        subscriptionId: input.subscriptionId,
        amount,
        taxAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        gstType: isInterState ? 'IGST' : 'CGST+SGST',
        totalAmount,
        currency: (input.currency || 'INR').toUpperCase(),
        status: 'DRAFT',
        dueDate: input.dueDate,
        buyerLegalName: buyer.name,
        buyerGstin: buyer.gstin,
        buyerState: buyer.state,
        buyerEmail: buyer.email,
        buyerPhone: buyer.phone,
        buyerAddressLine1: buyer.addressLine1,
        buyerAddressLine2: buyer.addressLine2,
        buyerCity: buyer.city,
        buyerPincode: buyer.pincode,
        buyerCountry: buyer.country,
        metadata: {
          ...(input.metadata || {}),
          gst: {
            isInterState,
            cgstAmount,
            sgstAmount,
            igstAmount,
          },
        },
        emailDeliveryStatus,
        emailDeliveryAttempts: 0,
        invoiceItems: {
          create: lineItems,
        },
      },
      include: {
        invoiceItems: true,
        user: true,
        sellerProfile: true,
        warehouse: true,
        ewayBill: true,
      },
    });

    this.logger.log(`Invoice created: ${invoiceNumber}`, {
      invoiceId: invoice.id,
      totalAmount,
      warehouseId: warehouse.id,
      sellerProfileId: sellerProfile.id,
    });

    this.generateInvoicePdf(invoice.id)
      .then(() => {
        if (invoice.emailDeliveryStatus === 'PENDING' && invoice.buyerEmail) {
          this.invoiceEmailWorker.enqueue(invoice.id).catch((err) => {
            this.logger.error('Failed to enqueue invoice email', {
              invoiceId: invoice.id,
              error: err.message,
            });
          });
        }
      })
      .catch((error) => {
        this.logger.error(`Failed to generate PDF for invoice ${invoice.id}`, error);
      });

    return invoice;
  }

  private resolveBuyerDetails(input: CreateInvoiceInput, user: any): BuyerDetails {
    const fallbackName = input.buyer?.name || user?.name || user?.email || 'Valued Customer';
    const fallbackEmail = input.buyer?.email || user?.email;

    return {
      name: fallbackName,
      gstin: input.buyer?.gstin,
      state: input.buyer?.state,
      email: fallbackEmail,
      phone: input.buyer?.phone,
      addressLine1: input.buyer?.addressLine1,
      addressLine2: input.buyer?.addressLine2,
      city: input.buyer?.city,
      pincode: input.buyer?.pincode,
      country: input.buyer?.country || 'India',
    };
  }

  private determineInterState(
    sellerGstin: string,
    sellerState: string,
    buyer: BuyerDetails,
  ): boolean {
    if (sellerGstin && buyer.gstin) {
      return this.gstService.isInterState(sellerGstin, buyer.gstin);
    }
    if (sellerState && buyer.state) {
      return sellerState.trim().toLowerCase() !== buyer.state.trim().toLowerCase();
    }
    return false;
  }

  private async fetchSellerProfile(warehouseId: number, sellerProfileId?: number) {
    if (sellerProfileId) {
      const profile = await this.prisma.warehouseSellerProfile.findFirst({
        where: {
          id: sellerProfileId,
          warehouseId,
          isActive: true,
        },
      });
      if (!profile) {
        throw new NotFoundException(
          `Seller profile ${sellerProfileId} not found for warehouse ${warehouseId}`,
        );
      }
      return profile;
    }

    const defaultProfile = await this.prisma.warehouseSellerProfile.findFirst({
      where: {
        warehouseId,
        isActive: true,
        isDefault: true,
      },
    });

    if (defaultProfile) {
      return defaultProfile;
    }

    const fallback = await this.prisma.warehouseSellerProfile.findFirst({
      where: {
        warehouseId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!fallback) {
      throw new NotFoundException(
        `No active seller profile configured for warehouse ${warehouseId}`,
      );
    }

    return fallback;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        invoiceItems: true,
        user: true,
        sellerProfile: true,
        warehouse: true,
        payments: true,
        ewayBill: true,
        subscription: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  /**
   * Get invoice by invoice number
   */
  async getInvoiceByNumber(invoiceNumber: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        invoiceItems: true,
        user: true,
        sellerProfile: true,
        warehouse: true,
        payments: true,
        ewayBill: true,
        subscription: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with number ${invoiceNumber} not found`);
    }

    return invoice;
  }

  /**
   * Get invoices for a user
   */
  async getInvoicesByUser(userId: number) {
    return this.prisma.invoice.findMany({
      where: { userId },
      include: {
        invoiceItems: true,
        subscription: true,
        sellerProfile: true,
        warehouse: true,
        payments: true,
        ewayBill: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generate PDF for invoice
   */
  async generateInvoicePdf(invoiceId: string): Promise<string> {
    console.log('[InvoiceService] generateInvoicePdf', { invoiceId });

    const invoice = await this.getInvoice(invoiceId);

    // Generate PDF
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);

    // Upload PDF to storage (S3, local storage, etc.)
    // For now, we'll store it locally or return a data URL
    // In production, upload to S3 and return the URL
    const { url: pdfUrl, key: storageKey } = await this.uploadPdf(
      pdfBuffer,
      `invoices/${invoice.invoiceNumber}.pdf`,
    );

    // Update invoice with PDF URL
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceUrl: pdfUrl,
        pdfStorageKey: storageKey,
        pdfUploadedAt: new Date(),
        status: invoice.status === 'DRAFT' ? 'PENDING' : invoice.status,
      },
    });

    this.logger.log(`PDF generated for invoice ${invoice.invoiceNumber}`, { pdfUrl });

    return pdfUrl;
  }

  /**
   * Upload PDF to storage
   * In production, this should upload to S3 or similar
   */
  private async uploadPdf(
    buffer: Buffer,
    filename: string,
  ): Promise<{ key: string; url: string }> {
    const normalizedKey = filename.startsWith('invoices/')
      ? filename
      : `invoices/${filename}`;
    const result = await this.storage.uploadBuffer(
      normalizedKey,
      buffer,
      'application/pdf',
      { cacheControl: 'public, max-age=31536000' },
    );
    return { key: normalizedKey, url: result.url };
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(invoiceId: string, paidAt?: Date) {
    const invoice = await this.getInvoice(invoiceId);

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: paidAt || new Date(),
      },
    });
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string) {
    const invoice = await this.getInvoice(invoiceId);

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Cannot cancel a paid invoice');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}
