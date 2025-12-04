import { Module } from '@nestjs/common';
import { WarehousesResolver } from './warehouses.resolver';
import { WarehousesService } from './warehouses.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WarehouseSellerProfileService } from './warehouse-seller-profile.service';
import { WarehouseSellerProfileResolver } from './warehouse-seller-profile.resolver';

@Module({
  imports: [PrismaModule],
  providers: [
    WarehousesResolver,
    WarehousesService,
    WarehouseSellerProfileService,
    WarehouseSellerProfileResolver,
  ],
  exports: [WarehousesService, WarehouseSellerProfileService],
})
export class WarehousesModule {}
