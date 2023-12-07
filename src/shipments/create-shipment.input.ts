import { InputType, Field, Int } from '@nestjs/graphql';
import { ShipmentStatus } from './shipment.model';
import { IsNotEmpty, IsString, IsInt, IsPositive, IsEnum, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class CreateShipmentInput {
  @Field()
  @IsNotEmpty({ message: 'Tracking number is required' })
  @IsString({ message: 'Tracking number must be a string' })
  trackingNumber: string;

  @Field(() => ShipmentStatus)
  @IsNotEmpty({ message: 'Shipment status is required' })
  @IsEnum(ShipmentStatus, { message: 'Invalid shipment status' })
  status: ShipmentStatus;

  @Field(() => Int)
  @IsNotEmpty({ message: 'Order ID is required' })
  @IsInt({ message: 'Order ID must be an integer' })
  @IsPositive({ message: 'Order ID must be positive' })
  orderId: number;

  @Field(() => Int)
  @IsNotEmpty({ message: 'Carrier ID is required' })
  @IsInt({ message: 'Carrier ID must be an integer' })
  @IsPositive({ message: 'Carrier ID must be positive' })
  carrierId: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate({ message: 'Shipped at must be a valid date' })
  @Type(() => Date)
  shippedAt?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate({ message: 'Delivered at must be a valid date' })
  @Type(() => Date)
  deliveredAt?: Date;
} 