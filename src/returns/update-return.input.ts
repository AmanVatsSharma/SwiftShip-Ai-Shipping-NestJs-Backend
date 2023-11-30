import { InputType, Field, Int } from '@nestjs/graphql';
import { ReturnStatus } from './return.model';
import { IsNotEmpty, IsString, IsEnum, IsInt, IsPositive, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class UpdateReturnInput {
  @Field(() => Int)
  @IsNotEmpty({ message: 'Return ID is required' })
  @IsInt({ message: 'Return ID must be an integer' })
  @IsPositive({ message: 'Return ID must be positive' })
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Return number must be a string' })
  returnNumber?: string;

  @Field(() => ReturnStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ReturnStatus, { message: 'Invalid return status' })
  status?: ReturnStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate({ message: 'Pickup scheduled at must be a valid date' })
  @Type(() => Date)
  pickupScheduledAt?: Date;
} 