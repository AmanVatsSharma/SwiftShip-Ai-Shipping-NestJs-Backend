import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreatePincodeZoneInput {
  @Field()
  pincode: string;
  @Field()
  zone: string;
  @Field({ defaultValue: false })
  oda: boolean;
  @Field(() => Int, { nullable: true })
  carrierId?: number;
}
