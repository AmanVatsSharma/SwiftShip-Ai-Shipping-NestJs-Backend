import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Carrier {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  apiKey: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
} 