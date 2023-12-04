import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';

export enum ShipmentStatus {
  PENDING = "PENDING",
  SHIPPED = "SHIPPED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED"
}

registerEnumType(ShipmentStatus, {
  name: 'ShipmentStatus'
});

@ObjectType()
export class Shipment {
  @Field(() => Int)
  id: number;

  @Field()
  trackingNumber: string;

  @Field(() => ShipmentStatus)
  status: ShipmentStatus;

  @Field(() => Int)
  orderId: number;

  @Field(() => Int)
  carrierId: number;

  @Field({ nullable: true })
  shippedAt?: Date;

  @Field({ nullable: true })
  deliveredAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
} 