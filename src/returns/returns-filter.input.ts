import { InputType, Field, Int } from '@nestjs/graphql';
import { ReturnStatus } from './return.model';
import { IsEnum, IsInt, IsPositive, IsOptional } from 'class-validator';

@InputType()
export class ReturnsFilterInput {
  @Field(() => ReturnStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ReturnStatus, { message: 'Invalid return status' })
  status?: ReturnStatus;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'Order ID must be an integer' })
  @IsPositive({ message: 'Order ID must be positive' })
  orderId?: number;
} 