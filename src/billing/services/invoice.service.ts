import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GstService } from './gst.service';
import { PdfService } from './pdf.service';
import { CreateInvoiceInput } from '../dto/create-invoice.input';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

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
    private readonly config: ConfigService,
  ) {}

  /**
   * Generate unique invoice number
   * Format: INV-YYYYMMDD-XXXXXX (e.g., INV-20250127-000001)
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get today's invoice count
    const datePrefix = `INV-${year}${month}${day}`;
    
    // For production, this should query the database for the last invoice number
    // For now, we'll use a random suffix
    const suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    return `${datePrefix}-${suffix}`;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput) {
    console.log('[InvoiceService] createInvoice', { userId: input.userId, itemCount: input.items.length });

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${input.userId} not found`);
    }

    // Validate subscription if provided
    if (input.subscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: input.subscriptionId },
      });

      if (!subscription) {
        throw new NotFoundException(`Subscription with ID ${input.subscriptionId} not found`);
      }
    }

    // Calculate totals for each item
    const invoiceItems = input.items.map((item) => {
      const totalPrice = item.unitPrice * item.quantity;
      const taxRate = item.taxRate || 0;
      const taxAmount = (totalPrice * taxRate) / 100;

      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        hsnCode: item.hsnCode,
        taxRate,
        taxAmount,
      };
    });

    // Calculate totals
    const amount = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = invoiceItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = amount + taxAmount;

    // Generate invoice number
    const invoiceNumber = this.generateInvoiceNumber();

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        id: uuidv4(),
        invoiceNumber,
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        amount,
        taxAmount,
        totalAmount,
        currency: input.currency || 'INR',
        status: 'DRAFT',
        dueDate: input.dueDate,
        metadata: input.metadata || {},
        items: {
          create: invoiceItems,
        },
      },
      include: {
        items: true,
        user: true,
      },
    });

    this.logger.log(`Invoice created: ${invoiceNumber}`, {
      invoiceId: invoice.id,
      totalAmount,
    });

    // Generate PDF asynchronously
    this.generateInvoicePdf(invoice.id).catch((error) => {
      this.logger.error(`Failed to generate PDF for invoice ${invoice.id}`, error);
    });

    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        user: true,
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
        items: true,
        user: true,
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
        items: true,
        subscription: true,
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
    const pdfUrl = await this.uploadPdf(pdfBuffer, `invoices/${invoice.invoiceNumber}.pdf`);

    // Update invoice with PDF URL
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceUrl: pdfUrl,
        status: 'PENDING', // Move from DRAFT to PENDING after PDF generation
      },
    });

    this.logger.log(`PDF generated for invoice ${invoice.invoiceNumber}`, { pdfUrl });

    return pdfUrl;
  }

  /**
   * Upload PDF to storage
   * In production, this should upload to S3 or similar
   */
  private async uploadPdf(buffer: Buffer, filename: string): Promise<string> {
    // TODO: Implement actual file upload to S3 or local storage
    // For now, return a placeholder URL
    const baseUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    return `${baseUrl}/api/invoices/${filename}`;
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
