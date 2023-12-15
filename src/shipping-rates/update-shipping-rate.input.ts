import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsInt, IsPositive, Min, Max, IsOptional } from 'class-validator';

@InputType()
export class UpdateShippingRateInput {
  @Field(() => Int)
  @IsNotEmpty({ message: 'Shipping rate ID is required' })
  @IsInt({ message: 'Shipping rate ID must be an integer' })
  @IsPositive({ message: 'Shipping rate ID must be positive' })
  id: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'Carrier ID must be an integer' })
  @IsPositive({ message: 'Carrier ID must be positive' })
  carrierId?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Service name must be a string' })
  serviceName?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsPositive({ message: 'Rate must be positive' })
  @Min(0.01, { message: 'Rate must be at least 0.01' })
  rate?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'Estimated delivery days must be an integer' })
  @Min(1, { message: 'Estimated delivery days must be at least 1' })
  @Max(30, { message: 'Estimated delivery days cannot exceed 30' })
  estimatedDeliveryDays?: number;
} 