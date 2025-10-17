import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdatePincodeZoneInput {
  @Field(() => Int)
  id: number;
  @Field({ nullable: true })
  zone?: string;
  @Field({ nullable: true })
  oda?: boolean;
  @Field(() => Int, { nullable: true })
  carrierId?: number;
}
