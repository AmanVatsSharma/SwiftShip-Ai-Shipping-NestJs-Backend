import { Injectable, Logger } from '@nestjs/common';
import { QueuesService } from '../../queues/queues.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../notifications/services/email.service';
import { StorageService } from '../../storage/storage.service';
import { Prisma } from '@prisma/client';

type InvoiceEmailPayload = Prisma.InvoiceGetPayload<{
  include: { user: true; sellerProfile: true; warehouse: true; ewayBill: true };
}>;

/**
 * Invoice Email Worker
 *
 * Handles queued delivery of invoice PDFs (and optional e-way bill attachments).
 */
@Injectable()
export class InvoiceEmailWorker {
  static readonly QUEUE = 'billing.invoice-email';
  private readonly logger = new Logger(InvoiceEmailWorker.name);

  constructor(
    private readonly queues: QueuesService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly storage: StorageService,
  ) {
    this.queues.createWorker(InvoiceEmailWorker.QUEUE, async (job) => {
      const { invoiceId } = job.data as { invoiceId: string };
      console.log('[InvoiceEmailWorker] processing', { invoiceId });
      await this.process(invoiceId);
    });
  }

  async enqueue(invoiceId: string) {
    console.log('[InvoiceEmailWorker] enqueue', { invoiceId });
    await this.queues.add(
      InvoiceEmailWorker.QUEUE,
      { invoiceId },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnFail: false,
      },
    );
  }

  private async process(invoiceId: string) {
    const invoice = (await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: true,
        sellerProfile: true,
        warehouse: true,
        ewayBill: true,
      },
    })) as InvoiceEmailPayload | null;

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.emailDeliveryStatus === 'SKIPPED') {
      this.logger.log('Invoice email skipped per configuration', { invoiceId });
      return;
    }

    if (!invoice.buyerEmail) {
      throw new Error(`Invoice ${invoiceId} missing buyer email`);
    }

    if (!invoice.pdfStorageKey) {
      throw new Error(`Invoice ${invoiceId} missing PDF storage key`);
    }

    const attachments = [
      await this.createAttachment(invoice.pdfStorageKey, `${invoice.invoiceNumber}.pdf`),
    ];

    if (invoice.ewayBill?.documentStorageKey) {
      attachments.push(
        await this.createAttachment(
          invoice.ewayBill.documentStorageKey,
          `${invoice.ewayBill.ewayBillNumber || 'eway-bill'}.pdf`,
        ),
      );
    }

    const templateData = {
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount.toFixed(2),
      currency: invoice.currency,
      buyerName: invoice.buyerLegalName || invoice.user?.name || invoice.user?.email,
      sellerName: invoice.sellerProfile?.legalName,
      downloadUrl: invoice.invoiceUrl,
      createdAt: invoice.createdAt.toLocaleDateString('en-IN'),
      dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString('en-IN') : 'Due on receipt',
    };

    const attempts = invoice.emailDeliveryAttempts + 1;
    const sent = await this.emailService.sendTemplateEmail(
      invoice.buyerEmail,
      'invoice-email',
      templateData,
      `Invoice ${invoice.invoiceNumber}`,
      attachments,
    );

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        emailDeliveryAttempts: attempts,
        emailDeliveryStatus: sent ? 'DELIVERED' : 'FAILED',
        emailDeliveredAt: sent ? new Date() : invoice.emailDeliveredAt,
      },
    });

    if (!sent) {
      throw new Error(`Failed to send invoice email for ${invoiceId}`);
    }

    this.logger.log('Invoice email delivered', { invoiceId });
  }

  private async createAttachment(storageKey: string, filename: string) {
    const buffer = await this.storage.getObjectBuffer(storageKey);
    return {
      filename,
      content: buffer.toString('base64'),
      type: 'application/pdf',
      disposition: 'attachment',
    };
  }
}
