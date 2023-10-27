import { Module } from '@nestjs/common';
import { CarrierResolver } from './carrier.resolver';
import { CarrierService } from './carrier.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [CarrierResolver, CarrierService, PrismaService],
  exports: [CarrierService],
})
export class CarriersModule {} 