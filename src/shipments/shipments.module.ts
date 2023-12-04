import { Module } from '@nestjs/common';
import { ShipmentsResolver } from './shipments.resolver';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [ShipmentsResolver, ShipmentsService, PrismaService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {} 