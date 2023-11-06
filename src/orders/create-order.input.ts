import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { OrderStatus } from './order.model';
import { IsNotEmpty, IsString, IsNumber, IsEnum, IsInt, IsPositive, IsOptional, Min } from 'class-validator';

@InputType()
export class CreateOrderInput {
  @Field()
  @IsNotEmpty({ message: 'Order number is required' })
  @IsString({ message: 'Order number must be a string' })
  orderNumber: string;

  @Field(() => Float)
  @IsNotEmpty({ message: 'Total is required' })
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Total must be a number' })
  @Min(0, { message: 'Total must be greater than or equal to 0' })
  total: number;

  @Field(() => Int)
  @IsNotEmpty({ message: 'User ID is required' })
  @IsInt({ message: 'User ID must be an integer' })
  @IsPositive({ message: 'User ID must be positive' })
  userId: number;

  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Invalid order status' })
  status?: OrderStatus;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'Carrier ID must be an integer' })
  @IsPositive({ message: 'Carrier ID must be positive' })
  carrierId?: number;
} 