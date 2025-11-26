import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from './services/invoice.service';
import { EwayBillService } from './services/eway-bill.service';
import { GstService } from './services/gst.service';
import { PdfService } from './services/pdf.service';
import { BillingResolver } from './billing.resolver';

/**
 * Billing Module
 * 
 * Handles all billing-related functionality including:
 * - Invoice generation and management
 * - PDF generation for invoices
 * - GST calculation and compliance
 * - E-way bill generation and tracking
 * 
 * Dependencies:
 * - PrismaService: Database access
 * - ConfigService: Configuration management
 * 
 * Exports:
 * - InvoiceService: For use in other modules
 * - EwayBillService: For use in other modules
 * - GstService: For use in other modules
 */
@Module({
  providers: [
    PrismaService,
    InvoiceService,
    EwayBillService,
    GstService,
    PdfService,
    BillingResolver,
  ],
  exports: [InvoiceService, EwayBillService, GstService],
})
export class BillingModule {}
