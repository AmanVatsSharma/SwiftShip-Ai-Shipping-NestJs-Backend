import { Module } from '@nestjs/common';
import { WarehousesResolver } from './warehouses.resolver';
import { WarehousesService } from './warehouses.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WarehousesResolver, WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
