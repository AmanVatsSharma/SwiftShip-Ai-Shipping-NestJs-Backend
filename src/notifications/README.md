# Notifications Module

## Email Delivery Enhancements

```
Invoice/Shipment event
        │
        ▼
┌────────────────────────┐
│InvoiceEmailWorker queue│  (BullMQ with retries/backoff)
└──────────┬─────────────┘
           │
           ▼
┌───────────────────────────────┐
│EmailService (SendGrid/SMTP)   │
│ - Handlebars templates        │
│ - Attachments (invoice/EWB)   │
└───────────────────────────────┘
```

- `EmailService.sendEmail` + `sendTemplateEmail` now accept attachment arrays (base64) and handle both SendGrid + SMTP transports.
- `invoice-email.hbs` template ships with CTA link plus summary block; attachments include invoice PDF + optional e-way bill.
- Successful sends update `Invoice.emailDeliveryStatus` and `emailDeliveryAttempts` for auditability.

## Usage

```ts
await this.emailService.sendTemplateEmail(
  'buyer@example.com',
  'invoice-email',
  templateData,
  'Invoice INV-0001',
  [
    {
      filename: 'INV-0001.pdf',
      content: buffer.toString('base64'),
      type: 'application/pdf',
    },
  ],
);
```

- When SendGrid credentials are not configured the service falls back to SMTP (if available). Otherwise it logs errors and returns `false`.
- Templates are cached in-memory for performance; set `NODE_ENV=production` to disable GraphQL playground for email secrets.
