import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WarehouseCoverage {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  warehouseId: number;

  @Field()
  pincode: string;

  @Field({ nullable: true })
  serviceLevel?: string | null;

  @Field(() => Int, { nullable: true })
  tatDays?: number | null;

  @Field()
  isOda: boolean;

  @Field(() => Float, { nullable: true })
  odaFee?: number | null;

  @Field(() => Int, { nullable: true })
  minWeightGrams?: number | null;

  @Field(() => Int, { nullable: true })
  maxWeightGrams?: number | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class Warehouse {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  code: string;

  @Field()
  addressLine1: string;

  @Field({ nullable: true })
  addressLine2?: string | null;

  @Field()
  city: string;

  @Field()
  state: string;

  @Field()
  pincode: string;

  @Field()
  country: string;

  @Field({ nullable: true })
  latitude?: number | null;

  @Field({ nullable: true })
  longitude?: number | null;

  @Field()
  isActive: boolean;

  @Field(() => Float, {
    nullable: true,
    description: 'Warehouse capacity in cubic meters if tracked',
  })
  capacityCbm?: number | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [WarehouseCoverage], { nullable: 'itemsAndList' })
  coverages?: WarehouseCoverage[] | null;
}
