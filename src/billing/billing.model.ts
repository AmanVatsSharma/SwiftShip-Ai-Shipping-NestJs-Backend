import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

/**
 * Invoice Item GraphQL Model
 */
@ObjectType()
export class InvoiceItem {
  @Field(() => Int)
  id: number;

  @Field(() => String)
  invoiceId: string;

  @Field(() => String)
  description: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  unitPrice: number;

  @Field(() => Float)
  totalPrice: number;

  @Field(() => String, { nullable: true })
  hsnCode?: string;

  @Field(() => Float)
  taxRate: number;

  @Field(() => Float)
  taxAmount: number;

  @Field(() => Date)
  createdAt: Date;
}

/**
 * Invoice GraphQL Model
 */
@ObjectType()
export class Invoice {
  @Field(() => String)
  id: string;

  @Field(() => String)
  invoiceNumber: string;

  @Field(() => Int)
  userId: number;

  @Field(() => String, { nullable: true })
  subscriptionId?: string;

  @Field(() => Float)
  amount: number;

  @Field(() => Float)
  taxAmount: number;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => String)
  currency: string;

  @Field(() => String)
  status: string;

  @Field(() => Date, { nullable: true })
  dueDate?: Date;

  @Field(() => Date, { nullable: true })
  paidAt?: Date;

  @Field(() => String, { nullable: true })
  invoiceUrl?: string;

  @Field(() => [InvoiceItem])
  items: InvoiceItem[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

/**
 * E-way Bill GraphQL Model
 */
@ObjectType()
export class EwayBill {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  shipmentId: number;

  @Field(() => String)
  ewayBillNumber: string;

  @Field(() => String)
  status: string;

  @Field(() => Date, { nullable: true })
  validUntil?: Date;

  @Field(() => String, { nullable: true })
  ewayBillUrl?: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

/**
 * GST Calculation Result
 */
@ObjectType()
export class GstCalculation {
  @Field(() => Float)
  baseAmount: number;

  @Field(() => Float)
  cgst: number; // Central GST

  @Field(() => Float)
  sgst: number; // State GST

  @Field(() => Float)
  igst: number; // Integrated GST (for inter-state)

  @Field(() => Float)
  totalTax: number;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => String)
  gstType: string; // 'CGST+SGST' for intra-state, 'IGST' for inter-state
}
