import { ObjectType, Field, Int, Float, registerEnumType } from '@nestjs/graphql';

export enum OrderStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED"
}

registerEnumType(OrderStatus, {
  name: 'OrderStatus'
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
  carrierId?: number;
} 