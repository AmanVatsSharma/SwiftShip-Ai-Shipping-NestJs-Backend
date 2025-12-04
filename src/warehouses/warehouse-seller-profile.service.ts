import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseSellerProfileInput } from './dto/create-seller-profile.input';
import { UpdateWarehouseSellerProfileInput } from './dto/update-seller-profile.input';

@Injectable()
export class WarehouseSellerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async listForWarehouse(warehouseId: number) {
    await this.ensureWarehouse(warehouseId);
    return this.prisma.warehouseSellerProfile.findMany({
      where: { warehouseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: CreateWarehouseSellerProfileInput, userId: number) {
    await this.ensureWarehouse(input.warehouseId);
    await this.ensureUniqueGstin(input.gstin, input.warehouseId);

    if (input.isDefault) {
      await this.resetDefault(input.warehouseId);
    }

    return this.prisma.warehouseSellerProfile.create({
      data: {
        ...input,
        userId,
        isDefault: !!input.isDefault,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(input: UpdateWarehouseSellerProfileInput) {
    const existing = await this.prisma.warehouseSellerProfile.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      throw new NotFoundException(`Seller profile ${input.id} not found`);
    }

    if (input.gstin && input.gstin !== existing.gstin) {
      await this.ensureUniqueGstin(input.gstin, existing.warehouseId, existing.id);
    }

    if (input.isDefault) {
      await this.resetDefault(existing.warehouseId, existing.id);
    }

    return this.prisma.warehouseSellerProfile.update({
      where: { id: input.id },
      data: {
        ...input,
        isDefault: input.isDefault ?? existing.isDefault,
      },
    });
  }

  private async ensureWarehouse(id: number) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
  }

  private async ensureUniqueGstin(gstin: string, warehouseId: number, ignoreId?: number) {
    const existing = await this.prisma.warehouseSellerProfile.findFirst({
      where: {
        gstin,
        warehouseId,
        ...(ignoreId && { id: { not: ignoreId } }),
      },
    });

    if (existing) {
      throw new BadRequestException('GSTIN already exists for this warehouse');
    }
  }

  private async resetDefault(warehouseId: number, ignoreId?: number) {
    await this.prisma.warehouseSellerProfile.updateMany({
      where: {
        warehouseId,
        ...(ignoreId && { id: { not: ignoreId } }),
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }
}
