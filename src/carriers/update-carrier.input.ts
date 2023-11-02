import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsInt, MinLength, MaxLength } from 'class-validator';

@InputType()
export class UpdateCarrierInput {
  @Field(() => Int)
  @IsNotEmpty({ message: 'Carrier ID is required' })
  @IsInt({ message: 'Carrier ID must be an integer' })
  id: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Carrier name must be a string' })
  @MinLength(2, { message: 'Carrier name must be at least 2 characters' })
  @MaxLength(100, { message: 'Carrier name cannot exceed 100 characters' })
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'API key must be a string' })
  @MinLength(8, { message: 'API key must be at least 8 characters' })
  apiKey?: string;
} 