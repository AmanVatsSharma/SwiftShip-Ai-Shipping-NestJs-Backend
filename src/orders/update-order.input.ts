import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { OrderStatus } from './order.model';
import { IsNotEmpty, IsString, IsNumber, IsEnum, IsInt, IsPositive, IsOptional, Min } from 'class-validator';

@InputType()
export class UpdateOrderInput {
  @Field(() => Int)
  @IsNotEmpty({ message: 'Order ID is required' })
  @IsInt({ message: 'Order ID must be an integer' })
  @IsPositive({ message: 'Order ID must be positive' })
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Order number must be a string' })
  orderNumber?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Total must be a number' })
  @Min(0, { message: 'Total must be greater than or equal to 0' })
  total?: number;

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