import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Role } from '../role.entity';

@ObjectType()
export class User {
  @Field(() => Int)
  id: number;

  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [Role], { nullable: 'itemsAndList' })
  roles?: Role[];
} 