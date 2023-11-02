import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

@InputType()
export class CreateCarrierInput {
  @Field()
  @IsNotEmpty({ message: 'Carrier name is required' })
  @IsString({ message: 'Carrier name must be a string' })
  @MinLength(2, { message: 'Carrier name must be at least 2 characters' })
  @MaxLength(100, { message: 'Carrier name cannot exceed 100 characters' })
  name: string;

  @Field()
  @IsNotEmpty({ message: 'API key is required' })
  @IsString({ message: 'API key must be a string' })
  @MinLength(8, { message: 'API key must be at least 8 characters' })
  apiKey: string;
} 