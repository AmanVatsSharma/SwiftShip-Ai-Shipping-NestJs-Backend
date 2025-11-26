# Billing Module

## Overview

The Billing Module handles all billing-related functionality including invoice generation, PDF creation, GST calculation, and E-way bill management for India.

## Features

### 1. Invoice Management ✅
- Create invoices with itemized billing
- Automatic invoice number generation (INV-YYYYMMDD-XXXXXX)
- GST calculation (CGST+SGST for intra-state, IGST for inter-state)
- Invoice status management (DRAFT, PENDING, PAID, OVERDUE, CANCELLED, REFUNDED)
- PDF generation for invoices

### 2. GST Compliance ✅
- GST calculation service
- Support for CGST, SGST, and IGST
- Automatic determination of inter-state vs intra-state
- GSTIN validation
- GST breakdown in invoices

### 3. E-way Bill Management ✅
- E-way bill generation for shipments
- E-way bill validation
- E-way bill cancellation
- Integration with GSTN API (placeholder for production)
- Automatic validity checking

### 4. PDF Generation ✅
- Professional invoice PDFs
- Company branding support
- Itemized billing with GST breakdown
- Automatic PDF storage

## GraphQL API

### Invoice Mutations

```graphql
# Create invoice
mutation {
  createInvoice(input: {
    userId: 1
    items: [
      {
        description: "Shipping Service"
        quantity: 1
        unitPrice: 1000
        hsnCode: "996511"
        taxRate: 18
      }
    ]
    currency: "INR"
  }) {
    id
    invoiceNumber
    totalAmount
    status
  }
}

# Generate PDF
mutation {
  generateInvoicePdf(invoiceId: "uuid")
}

# Mark as paid
mutation {
  markInvoiceAsPaid(invoiceId: "uuid")
}

# Cancel invoice
mutation {
  cancelInvoice(invoiceId: "uuid")
}
```

### Invoice Queries

```graphql
# Get invoice by ID
query {
  invoice(id: "uuid") {
    id
    invoiceNumber
    amount
    taxAmount
    totalAmount
    status
    items {
      description
      quantity
      unitPrice
      taxAmount
    }
  }
}

# Get invoice by number
query {
  invoiceByNumber(invoiceNumber: "INV-20250127-000001") {
    id
    totalAmount
  }
}

# Get user's invoices
query {
  myInvoices {
    id
    invoiceNumber
    totalAmount
    status
  }
}
```

### E-way Bill Mutations

```graphql
# Generate E-way bill
mutation {
  generateEwayBill(input: {
    shipmentId: 1
    consignorGstin: "27ABCDE1234F1Z5"
    consigneeGstin: "29FGHIJ5678K2Z6"
    placeOfDispatch: "Mumbai, Maharashtra"
    placeOfDelivery: "Delhi, Delhi"
    invoiceValue: 60000
    invoiceNumber: "INV-20250127-000001"
    invoiceDate: "2025-01-27"
    hsnCode: "996511"
  }) {
    id
    ewayBillNumber
    status
    validUntil
  }
}

# Cancel E-way bill
mutation {
  cancelEwayBill(id: 1, reason: "Shipment cancelled")
}
```

### E-way Bill Queries

```graphql
# Get E-way bill
query {
  ewayBill(id: 1) {
    ewayBillNumber
    status
    validUntil
  }
}

# Get E-way bill by shipment
query {
  ewayBillByShipment(shipmentId: 1) {
    ewayBillNumber
    status
  }
}

# Validate E-way bill
query {
  validateEwayBill(ewayBillNumber: "EWB-20250127-000001")
}
```

### GST Queries

```graphql
# Calculate GST
query {
  calculateGst(
    baseAmount: 1000
    taxRate: 18
    isInterState: false
  ) {
    baseAmount
    cgst
    sgst
    igst
    totalTax
    totalAmount
    gstType
  }
}

# Check if E-way bill required
query {
  isEwayBillRequired(
    invoiceValue: 60000
    isInterState: false
  )
}
```

## Configuration

### Environment Variables

```bash
# Application URL (for PDF URLs)
APP_URL=http://localhost:3000

# GSTN API Configuration (for E-way bill generation)
GSTN_API_URL=https://ewaybillgst.gov.in
GSTN_API_KEY=your_gstn_api_key
```

## Database Schema

### Invoice Model
- `id`: UUID (primary key)
- `invoiceNumber`: String (unique)
- `userId`: Int (foreign key)
- `subscriptionId`: String (optional, foreign key)
- `amount`: Float (base amount)
- `taxAmount`: Float (GST amount)
- `totalAmount`: Float (amount + tax)
- `currency`: String (default: INR)
- `status`: InvoiceStatus enum
- `dueDate`: DateTime (optional)
- `paidAt`: DateTime (optional)
- `invoiceUrl`: String (PDF URL)

### InvoiceItem Model
- `id`: Int (primary key)
- `invoiceId`: String (foreign key)
- `description`: String
- `quantity`: Int
- `unitPrice`: Float
- `totalPrice`: Float
- `hsnCode`: String (optional)
- `taxRate`: Float (percentage)
- `taxAmount`: Float

### EwayBill Model
- `id`: Int (primary key)
- `shipmentId`: Int (unique, foreign key)
- `ewayBillNumber`: String (unique)
- `consignorGstin`: String
- `consigneeGstin`: String
- `placeOfDispatch`: String
- `placeOfDelivery`: String
- `invoiceValue`: Float
- `invoiceNumber`: String
- `invoiceDate`: DateTime
- `hsnCode`: String
- `status`: String (ACTIVE, EXPIRED, CANCELLED)
- `validUntil`: DateTime

## Implementation Details

### GST Calculation

The GST service calculates tax based on:
- **Intra-state** (same state): CGST + SGST (each half of tax rate)
- **Inter-state** (different states): IGST (full tax rate)

Example:
- Base amount: ₹1,000
- Tax rate: 18%
- Intra-state: CGST (9%) = ₹90, SGST (9%) = ₹90, Total = ₹1,180
- Inter-state: IGST (18%) = ₹180, Total = ₹1,180

### E-way Bill Requirements

E-way bill is required when:
- Invoice value ≥ ₹50,000 (inter-state)
- Invoice value ≥ ₹50,000 (intra-state, in some states)

### PDF Generation

PDFs are generated using PDFKit library and include:
- Company details
- Invoice number and date
- Bill-to information
- Itemized billing table
- GST breakdown
- Total amounts
- Footer with terms

## Dependencies

- `pdfkit`: PDF generation
- `@prisma/client`: Database access
- `uuid`: Invoice ID generation

## Future Enhancements

1. **GSTN API Integration**: Complete integration with actual GSTN API for E-way bill generation
2. **PDF Storage**: Upload PDFs to S3 or similar cloud storage
3. **Invoice Templates**: Customizable invoice templates
4. **Email Integration**: Send invoices via email automatically
5. **Multi-currency Support**: Support for multiple currencies
6. **Tax Reports**: Generate GST reports and returns

## Notes

- E-way bill generation currently uses mock API calls. In production, integrate with actual GSTN API.
- PDF storage is currently placeholder. Implement actual file storage (S3, local storage, etc.).
- Invoice number generation should query database for sequential numbering in production.
