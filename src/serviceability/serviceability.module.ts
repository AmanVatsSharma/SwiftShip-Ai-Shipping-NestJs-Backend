import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceabilityAdminResolver } from './serviceability.resolver';
import { ServiceabilityService } from '../rate-shop/serviceability.service';

@Module({
  providers: [PrismaService, ServiceabilityAdminResolver, ServiceabilityService],
  exports: [ServiceabilityService],
})
export class ServiceabilityModule {}
