import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseInput } from './dto/create-warehouse.input';
import { UpdateWarehouseInput } from './dto/update-warehouse.input';
import { UpsertWarehouseCoverageInput } from './dto/upsert-warehouse-coverage.input';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      include: { coverages: true },
    });
  }

  async findOne(id: number) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { coverages: true },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
    return warehouse;
  }

  async create(input: CreateWarehouseInput) {
    return this.prisma.warehouse.create({
      data: input,
      include: { coverages: true },
    });
  }

  async update(input: UpdateWarehouseInput) {
    await this.ensureWarehouseExists(input.id);
    const { id, ...payload } = input;
    return this.prisma.warehouse.update({
      where: { id },
      data: payload,
      include: { coverages: true },
    });
  }

  async delete(id: number) {
    await this.ensureWarehouseExists(id);
    const blockingOrder = await this.prisma.order.findFirst({
      where: { warehouseId: id },
      select: { id: true },
    });
    if (blockingOrder) {
      throw new BadRequestException(
        'Cannot delete warehouse that is linked to orders',
      );
    }
    const blockingShipment = await this.prisma.shipment.findFirst({
      where: { warehouseId: id },
      select: { id: true },
    });
    if (blockingShipment) {
      throw new BadRequestException(
        'Cannot delete warehouse that is linked to shipments',
      );
    }
    await this.prisma.warehouseCoverage.deleteMany({
      where: { warehouseId: id },
    });
    await this.prisma.warehouseStock.deleteMany({ where: { warehouseId: id } });
    await this.prisma.warehouse.delete({ where: { id } });
    return true;
  }

  async upsertCoverage(input: UpsertWarehouseCoverageInput) {
    await this.ensureWarehouseExists(input.warehouseId);
    return this.prisma.warehouseCoverage.upsert({
      where: {
        warehouseId_pincode: {
          warehouseId: input.warehouseId,
          pincode: input.pincode,
        },
      },
      create: {
        warehouseId: input.warehouseId,
        pincode: input.pincode,
        tatDays: input.tatDays,
        isOda: input.isOda ?? false,
        odaFee: input.odaFee,
        minWeightGrams: input.minWeightGrams,
        maxWeightGrams: input.maxWeightGrams,
      },
      update: {
        tatDays: input.tatDays,
        isOda: input.isOda ?? false,
        odaFee: input.odaFee,
        minWeightGrams: input.minWeightGrams,
        maxWeightGrams: input.maxWeightGrams,
      },
    });
  }

  async coveragesForWarehouse(warehouseId: number) {
    await this.ensureWarehouseExists(warehouseId);
    return this.prisma.warehouseCoverage.findMany({
      where: { warehouseId },
      orderBy: { pincode: 'asc' },
    });
  }

  private async ensureWarehouseExists(id: number) {
    const exists = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
  }
}
