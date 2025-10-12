import { Module } from '@nestjs/common';
import { RateShopService } from './rate-shop.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceabilityService } from './serviceability.service';

@Module({
  providers: [PrismaService, RateShopService, ServiceabilityService],
  exports: [RateShopService, ServiceabilityService],
})
export class RateShopModule {}
