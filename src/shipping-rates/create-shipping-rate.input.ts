import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsInt, IsPositive, Min, Max } from 'class-validator';

@InputType()
export class CreateShippingRateInput {
  @Field(() => Int)
  @IsNotEmpty({ message: 'Carrier ID is required' })
  @IsInt({ message: 'Carrier ID must be an integer' })
  @IsPositive({ message: 'Carrier ID must be positive' })
  carrierId: number;

  @Field()
  @IsNotEmpty({ message: 'Service name is required' })
  @IsString({ message: 'Service name must be a string' })
  serviceName: string;

  @Field(() => Float)
  @IsNotEmpty({ message: 'Rate is required' })
  @IsPositive({ message: 'Rate must be positive' })
  @Min(0.01, { message: 'Rate must be at least 0.01' })
  rate: number;

  @Field(() => Int)
  @IsNotEmpty({ message: 'Estimated delivery days is required' })
  @IsInt({ message: 'Estimated delivery days must be an integer' })
  @Min(1, { message: 'Estimated delivery days must be at least 1' })
  @Max(30, { message: 'Estimated delivery days cannot exceed 30' })
  estimatedDeliveryDays: number;
} 