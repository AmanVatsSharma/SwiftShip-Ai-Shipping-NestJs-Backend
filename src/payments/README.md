# Payments & Reconciliation

## Flow Overview

```
┌─────────────┐   intent   ┌──────────────────┐   webhook/verify   ┌──────────────────────┐
│GraphQL Input│──────────▶│PaymentGateway impl│───────────────────▶│PaymentService.verify │
└──────┬──────┘            └────────┬─────────┘                    └──────────┬───────────┘
       │                             │                                          │
       │create intent                │                                          │reconcileInvoicePayment()
       ▼                             ▼                                          ▼
┌────────────┐        ┌───────────────────────────┐                ┌────────────────────────┐
│Prisma.Payment│◀────│Stripe/Razorpay client data│◀──────────────▶│Invoice + metadata audit│
└────────────┘        └───────────────────────────┘                └────────────────────────┘
```

- If `invoiceId` is supplied the payment amount/currency are validated against the invoice total.
- Gateway metadata is merged with local metadata; reconciliation metadata tracks deltas (`amountDelta`, reasons).
- Reconciliation statuses:
  - `NOT_APPLICABLE`: no invoice linked.
  - `PENDING_REVIEW`: invoice linked but payment not yet succeeded.
  - `MATCHED`: payment succeeded and amount matches invoice (invoice marked `PAID`).
  - `PARTIAL`: payment succeeded but amount < invoice total.
  - `MISMATCH`: invoice missing or amount > invoice total.

## GraphQL Additions

```graphql
mutation CreatePaymentIntent {
  createPaymentIntent(input: {
    userId: 1
    amount: 1180
    currency: "INR"
    gateway: STRIPE
    invoiceId: "inv-uuid"
  }) {
    paymentId
    status
  }
}

mutation VerifyPayment {
  verifyPayment(input: { paymentId: "pay-uuid" }) {
    id
    status
    reconciliationStatus
    invoice {
      id
      invoiceNumber
      status
    }
  }
}
```

## Implementation Notes

- `CreatePaymentIntentInput` now allows `invoiceId` to bind payments to invoices.
- Payment model exposes `invoiceId`, `invoice`, `reconciliationStatus`, and `reconciledAt`.
- `reconcileInvoicePayment` runs after every verification to keep invoices synced.
- Errors set `reconciliationStatus=MISMATCH` with root-cause stored in `reconciliationMetadata`.
