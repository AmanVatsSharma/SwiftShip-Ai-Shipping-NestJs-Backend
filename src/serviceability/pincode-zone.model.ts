import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PincodeZoneModel {
  @Field(() => Int)
  id: number;

  @Field()
  pincode: string;

  @Field()
  zone: string;

  @Field()
  oda: boolean;

  @Field(() => Int, { nullable: true })
  carrierId?: number | null;
}
