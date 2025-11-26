import { InputType, Field, Float, Int } from '@nestjs/graphql';

/**
 * Input for creating an invoice item
 */
@InputType()
export class CreateInvoiceItemInput {
  @Field(() => String, { description: 'Item description' })
  description: string;

  @Field(() => Int, { description: 'Quantity', defaultValue: 1 })
  quantity: number;

  @Field(() => Float, { description: 'Unit price' })
  unitPrice: number;

  @Field(() => String, { description: 'HSN/SAC code for GST', nullable: true })
  hsnCode?: string;

  @Field(() => Float, { description: 'Tax rate percentage (e.g., 18 for 18%)', defaultValue: 0 })
  taxRate?: number;
}

/**
 * Input for creating an invoice
 */
@InputType()
export class CreateInvoiceInput {
  @Field(() => Int, { description: 'User ID' })
  userId: number;

  @Field(() => String, { description: 'Subscription ID (optional)', nullable: true })
  subscriptionId?: string;

  @Field(() => [CreateInvoiceItemInput], { description: 'Invoice items' })
  items: CreateInvoiceItemInput[];

  @Field(() => String, { description: 'Currency code', defaultValue: 'INR' })
  currency?: string;

  @Field(() => Date, { description: 'Due date', nullable: true })
  dueDate?: Date;

  @Field(() => Object, { description: 'Additional metadata', nullable: true })
  metadata?: Record<string, any>;
}
