import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class ShippingRate {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  carrierId: number;

  @Field()
  serviceName: string;

  @Field(() => Float)
  rate: number;

  @Field(() => Int)
  estimatedDeliveryDays: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
} 