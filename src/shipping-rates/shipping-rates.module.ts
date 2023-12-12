import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingRatesResolver } from './shipping-rates.resolver';
import { ShippingRatesService } from './shipping-rates.service';

@Module({
  providers: [ShippingRatesResolver, ShippingRatesService, PrismaService],
  exports: [ShippingRatesService],
})
export class ShippingRatesModule {} 