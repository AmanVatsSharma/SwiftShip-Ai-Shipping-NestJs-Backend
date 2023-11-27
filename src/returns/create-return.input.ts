import { InputType, Field, Int } from '@nestjs/graphql';
import { ReturnStatus } from './return.model';
import { IsNotEmpty, IsString, IsEnum, IsInt, IsPositive, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class CreateReturnInput {
  @Field()
  @IsNotEmpty({ message: 'Return number is required' })
  @IsString({ message: 'Return number must be a string' })
  returnNumber: string;

  @Field(() => ReturnStatus)
  @IsNotEmpty({ message: 'Return status is required' })
  @IsEnum(ReturnStatus, { message: 'Invalid return status' })
  status: ReturnStatus;

  @Field()
  @IsNotEmpty({ message: 'Reason is required' })
  @IsString({ message: 'Reason must be a string' })
  reason: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate({ message: 'Pickup scheduled at must be a valid date' })
  @Type(() => Date)
  pickupScheduledAt?: Date;

  @Field(() => Int)
  @IsNotEmpty({ message: 'Order ID is required' })
  @IsInt({ message: 'Order ID must be an integer' })
  @IsPositive({ message: 'Order ID must be positive' })
  orderId: number;
} 