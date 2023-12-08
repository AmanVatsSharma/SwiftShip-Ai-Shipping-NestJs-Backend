import { InputType, Field, Int } from '@nestjs/graphql';
import { ShipmentStatus } from './shipment.model';
import { IsNotEmpty, IsString, IsInt, IsPositive, IsEnum, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class UpdateShipmentInput {
  @Field(() => Int)
  @IsNotEmpty({ message: 'Shipment ID is required' })
  @IsInt({ message: 'Shipment ID must be an integer' })
  @IsPositive({ message: 'Shipment ID must be positive' })
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Tracking number must be a string' })
  trackingNumber?: string;

  @Field(() => ShipmentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ShipmentStatus, { message: 'Invalid shipment status' })
  status?: ShipmentStatus;

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