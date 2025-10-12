import { Module } from '@nestjs/common';
import { ShipmentsGateway } from './shipments.gateway';
import { ShipmentsResolver } from './shipments.resolver';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CarrierAdapterService } from '../carriers/carrier-adapter.service';

@Module({
  providers: [ShipmentsResolver, ShipmentsService, ShipmentsGateway, PrismaService, CarrierAdapterService],
  exports: [ShipmentsService, ShipmentsGateway],
})
export class ShipmentsModule {} 