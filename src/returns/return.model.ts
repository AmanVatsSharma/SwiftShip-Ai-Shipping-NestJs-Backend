import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';

export enum ReturnStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

registerEnumType(ReturnStatus, {
  name: 'ReturnStatus'
});

@ObjectType()
export class Return {
  @Field(() => Int)
  id: number;

  @Field()
  returnNumber: string;

  @Field(() => ReturnStatus)
  status: ReturnStatus;

  @Field()
  reason: string;

  @Field({ nullable: true })
  pickupScheduledAt?: Date;

  @Field(() => Int)
  orderId: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
} 