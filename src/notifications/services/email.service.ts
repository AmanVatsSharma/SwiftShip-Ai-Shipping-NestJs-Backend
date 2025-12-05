import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface EmailAttachment {
  filename: string;
  content: string;
  type?: string;
  disposition?: string;
}

/**
 * Email Service
 * 
 * Handles email sending with support for multiple providers.
 * 
 * Features:
 * - SendGrid integration (primary)
 * - SMTP fallback
 * - Template rendering with Handlebars
 * - Email queue support (via BullMQ)
 * 
 * Configuration:
 * - SENDGRID_API_KEY: SendGrid API key (primary)
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD: SMTP fallback
 * 
 * Templates:
 * - Templates stored in src/notifications/templates/
 * - Handlebars for variable substitution
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sendGridApiKey: string | null;
  private readonly smtpTransporter: nodemailer.Transporter | null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private readonly config: ConfigService) {
    this.sendGridApiKey = this.config.get<string>('SENDGRID_API_KEY') || null;
    this.fromEmail = this.config.get<string>('EMAIL_FROM') || 'noreply@swiftship.ai';
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME') || 'SwiftShip AI';

    // Initialize SendGrid if API key is provided
    if (this.sendGridApiKey) {
      sgMail.setApiKey(this.sendGridApiKey);
      this.logger.log('SendGrid email service initialized');
    } else {
      this.logger.warn('SENDGRID_API_KEY not configured, SendGrid disabled');
    }

    // Initialize SMTP transporter as fallback
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = this.config.get<number>('SMTP_PORT');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPassword = this.config.get<string>('SMTP_PASSWORD');

    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });
      this.logger.log('SMTP email service initialized', { host: smtpHost, port: smtpPort });
    } else {
      this.logger.warn('SMTP configuration incomplete, SMTP disabled');
      this.smtpTransporter = null;
    }

    if (!this.sendGridApiKey && !this.smtpTransporter) {
      this.logger.error('No email service configured. Emails will not be sent.');
    }
  }

  /**
   * Send email
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param html - HTML content
   * @param text - Plain text content (optional)
   * @param from - Sender email (optional, uses default)
   * @returns Success status
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    from?: string,
    attachments?: EmailAttachment[],
  ): Promise<boolean> {
    this.logger.log('Sending email', {
      to,
      subject,
      hasHtml: !!html,
      hasText: !!text,
      attachmentCount: attachments?.length || 0,
    });

    try {
      // Try SendGrid first
      if (this.sendGridApiKey) {
        await this.sendViaSendGrid(to, subject, html, text, from, attachments);
        return true;
      }

      // Fallback to SMTP
      if (this.smtpTransporter) {
        await this.sendViaSMTP(to, subject, html, text, from, attachments);
        return true;
      }

      this.logger.error('No email service available');
      return false;
    } catch (error) {
      this.logger.error('Failed to send email', {
        to,
        subject,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send email using template
   * @param to - Recipient email address
   * @param templateName - Template name (without .hbs extension)
   * @param data - Template data
   * @param subject - Email subject (can use template variables)
   * @returns Success status
   */
  async sendTemplateEmail(
    to: string,
    templateName: string,
    data: Record<string, any>,
    subject?: string,
    attachments?: EmailAttachment[],
  ): Promise<boolean> {
    this.logger.log('Sending template email', {
      to,
      templateName,
      hasData: !!data,
    });

    try {
      // Load and compile template
      const template = await this.getTemplate(templateName);
      const html = template(data);

      // Render subject if provided
      const renderedSubject = subject
        ? this.renderTemplate(subject, data)
        : `SwiftShip AI - ${templateName}`;

      return this.sendEmail(to, renderedSubject, html, undefined, undefined, attachments);
    } catch (error) {
      this.logger.error('Failed to send template email', {
        to,
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    to: string,
    orderNumber: string,
    orderTotal: number,
    orderItems: Array<{ name: string; quantity: number; price: number }>,
  ): Promise<boolean> {
    return this.sendTemplateEmail(
      to,
      'order-confirmation',
      {
        orderNumber,
        orderTotal,
        orderItems,
        orderDate: new Date().toLocaleDateString(),
      },
      'Order Confirmation - {{orderNumber}}',
    );
  }

  /**
   * Send shipping label email
   */
  async sendShippingLabel(
    to: string,
    trackingNumber: string,
    labelUrl: string,
    carrierName: string,
  ): Promise<boolean> {
    return this.sendTemplateEmail(
      to,
      'shipping-label',
      {
        trackingNumber,
        labelUrl,
        carrierName,
        trackingUrl: `https://swiftship.ai/track/${trackingNumber}`,
      },
      'Your Shipping Label - {{trackingNumber}}',
    );
  }

  /**
   * Send delivery confirmation email
   */
  async sendDeliveryConfirmation(
    to: string,
    trackingNumber: string,
    deliveredAt: Date,
  ): Promise<boolean> {
    return this.sendTemplateEmail(
      to,
      'delivery-confirmation',
      {
        trackingNumber,
        deliveredAt: deliveredAt.toLocaleDateString(),
        deliveredTime: deliveredAt.toLocaleTimeString(),
      },
      'Package Delivered - {{trackingNumber}}',
    );
  }

  /**
   * Send return request email
   */
  async sendReturnRequest(
    to: string,
    returnNumber: string,
    orderNumber: string,
    reason: string,
  ): Promise<boolean> {
    return this.sendTemplateEmail(
      to,
      'return-request',
      {
        returnNumber,
        orderNumber,
        reason,
        returnDate: new Date().toLocaleDateString(),
      },
      'Return Request - {{returnNumber}}',
    );
  }

  /**
   * Send NDR notification email
   */
  async sendNdrNotification(
    to: string,
    trackingNumber: string,
    reason: string,
    actionRequired: string,
  ): Promise<boolean> {
    return this.sendTemplateEmail(
      to,
      'ndr-notification',
      {
        trackingNumber,
        reason,
        actionRequired,
        trackingUrl: `https://swiftship.ai/track/${trackingNumber}`,
      },
      'Action Required - Delivery Issue - {{trackingNumber}}',
    );
  }

  private async sendViaSendGrid(
    to: string,
    subject: string,
    html: string,
    text?: string,
    from?: string,
    attachments?: EmailAttachment[],
  ): Promise<void> {
    const msg: sgMail.MailDataRequired = {
      to,
      from: from || {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject,
      html,
      ...(text && { text }),
      ...(attachments?.length
        ? {
            attachments: attachments.map((attachment) => ({
              filename: attachment.filename,
              content: attachment.content,
              type: attachment.type || 'application/octet-stream',
              disposition: attachment.disposition || 'attachment',
            })),
          }
        : {}),
    };

    await sgMail.send(msg);
    this.logger.log('Email sent via SendGrid', { to, subject });
  }

  private async sendViaSMTP(
    to: string,
    subject: string,
    html: string,
    text?: string,
    from?: string,
    attachments?: EmailAttachment[],
  ): Promise<void> {
    if (!this.smtpTransporter) {
      throw new Error('SMTP transporter not initialized');
    }

    await this.smtpTransporter.sendMail({
      from: from || `${this.fromName} <${this.fromEmail}>`,
      to,
      subject,
      html,
      text: text || this.stripHtml(html),
      ...(attachments?.length
        ? {
            attachments: attachments.map((attachment) => ({
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.type || 'application/octet-stream',
              encoding: 'base64',
              cid: undefined,
              disposition: attachment.disposition || 'attachment',
            })),
          }
        : {}),
    });

    this.logger.log('Email sent via SMTP', { to, subject });
  }

  private async getTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // Load template file
    const templatePath = join(
      process.cwd(),
      'src',
      'notifications',
      'templates',
      `${templateName}.hbs`
    );

    try {
      const templateContent = readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      this.logger.error('Failed to load email template', {
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Template ${templateName} not found`);
    }
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    const compiled = handlebars.compile(template);
    return compiled(data);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n').trim();
  }
}
