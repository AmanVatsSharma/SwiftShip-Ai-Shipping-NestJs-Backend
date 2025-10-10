import { ObjectType, Field, Int, Float, registerEnumType } from '@nestjs/graphql';
import { OrderStatus } from '@prisma/client';

// Reuse Prisma enum to avoid TS incompatibilities between layers
registerEnumType(OrderStatus, {
  name: 'OrderStatus',
});

@ObjectType()
export class Order {
  @Field(() => Int)
  id: number;

  @Field()
  orderNumber: string;

  @Field(() => Float)
  total: number;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Int)
  userId: number;

  @Field(() => Int, { nullable: true })
  carrierId: number | null;
} 

export { OrderStatus };