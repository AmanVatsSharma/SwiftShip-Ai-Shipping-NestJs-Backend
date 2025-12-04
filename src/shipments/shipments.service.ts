import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Shipment as ShipmentEntity,
  ShipmentStatus,
  LabelStatus,
} from '@prisma/client';
import { CreateShipmentInput } from './create-shipment.input';
import { UpdateShipmentInput } from './update-shipment.input';
import { ShipmentsFilterInput } from './shipments-filter.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateLabelInput } from './create-label.input';
import { IngestTrackingInput } from './ingest-tracking.input';
import { CarrierAdapterService } from '../carriers/carrier-adapter.service';
import { RateShopService } from '../rate-shop/rate-shop.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class ShipmentsService {
  constructor(
    private prisma: PrismaService,
    private carrierAdapters: CarrierAdapterService,
    private rateShop: RateShopService,
    private metrics: MetricsService,
  ) {}

  async getShipment(id: number): Promise<ShipmentEntity> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        warehouse: { include: { coverages: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    return shipment;
  }

  async getShipments(): Promise<ShipmentEntity[]> {
    return this.prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { include: { coverages: true } },
      },
    });
  }

  async createShipment(data: CreateShipmentInput): Promise<ShipmentEntity> {
    try {
      // Verify that the order exists
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
        include: { warehouse: true },
      });

      if (!order) {
        throw new BadRequestException(
          `Order with ID ${data.orderId} not found`,
        );
      }

      // Verify that the carrier exists
      const carrier = await this.prisma.carrier.findUnique({
        where: { id: data.carrierId },
      });

      if (!carrier) {
        throw new BadRequestException(
          `Carrier with ID ${data.carrierId} not found`,
        );
      }

      const resolvedWarehouseId = data.warehouseId ?? order.warehouseId;
      if (!resolvedWarehouseId) {
        throw new BadRequestException(
          'No warehouse assigned to this order. Provide warehouseId when creating a shipment.',
        );
      }

      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: resolvedWarehouseId },
      });

      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse with ID ${resolvedWarehouseId} not found`,
        );
      }

      const originPincode = data.originPincode ?? warehouse.pincode;
      const destinationPincode =
        data.destinationPincode ?? order.destinationPincode;

      if (!originPincode) {
        throw new BadRequestException(
          'Origin pincode is required to create a shipment',
        );
      }

      if (!destinationPincode) {
        throw new BadRequestException(
          'Destination pincode is required to create a shipment',
        );
      }

      const weightGrams = data.weightGrams ?? order.packageWeightGrams;
      if (!weightGrams) {
        throw new BadRequestException(
          'Weight is required to create a shipment',
        );
      }

      const lengthCm = data.lengthCm ?? order.packageLengthCm;
      const widthCm = data.widthCm ?? order.packageWidthCm;
      const heightCm = data.heightCm ?? order.packageHeightCm;

      // Status validation - if shippedAt is set, status should be SHIPPED or later
      if (data.shippedAt && data.status === 'PENDING') {
        throw new BadRequestException(
          'Status must be SHIPPED or later if shippedAt is provided',
        );
      }

      // Status validation - if deliveredAt is set, status should be DELIVERED
      if (data.deliveredAt && data.status !== 'DELIVERED') {
        throw new BadRequestException(
          'Status must be DELIVERED if deliveredAt is provided',
        );
      }

      return this.prisma.shipment.create({
        data: {
          trackingNumber: data.trackingNumber,
          status: data.status,
          orderId: data.orderId,
          carrierId: data.carrierId,
          shippedAt: data.shippedAt,
          deliveredAt: data.deliveredAt,
          warehouseId: resolvedWarehouseId,
          originPincode,
          destinationPincode,
          weightGrams,
          lengthCm,
          widthCm,
          heightCm,
        },
        include: { warehouse: { include: { coverages: true } } },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Shipment with tracking number ${data.trackingNumber} already exists`,
          );
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Invalid foreign key reference');
        }
      }

      throw error;
    }
  }

  async updateShipment(data: UpdateShipmentInput): Promise<ShipmentEntity> {
    const { id, ...updateData } = data;

    // Check if shipment exists
    await this.getShipment(id);

    // If warehouse change requested, validate
    if (updateData.warehouseId) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: updateData.warehouseId },
      });
      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse with ID ${updateData.warehouseId} not found`,
        );
      }
    }

    // Get the current state to perform validations
    const currentShipment = await this.prisma.shipment.findUnique({
      where: { id },
    });

    // Since we just verified the shipment exists with getShipment, currentShipment shouldn't be null
    if (!currentShipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    // Status validation - if shippedAt is set, status should be SHIPPED or later
    if (
      (updateData.shippedAt || currentShipment.shippedAt) &&
      updateData.status === 'PENDING'
    ) {
      throw new BadRequestException(
        'Status cannot be PENDING if shippedAt is set',
      );
    }

    // Status validation - if deliveredAt is set, status should be DELIVERED
    if (
      (updateData.deliveredAt || currentShipment.deliveredAt) &&
      updateData.status &&
      updateData.status !== 'DELIVERED'
    ) {
      throw new BadRequestException(
        'Status must be DELIVERED if deliveredAt is set',
      );
    }

    // If status is changing to DELIVERED, set deliveredAt to now if not provided
    if (
      updateData.status === 'DELIVERED' &&
      !updateData.deliveredAt &&
      !currentShipment.deliveredAt
    ) {
      updateData.deliveredAt = new Date();
    }

    // If status is changing to SHIPPED, set shippedAt to now if not provided
    if (
      updateData.status === 'SHIPPED' &&
      !updateData.shippedAt &&
      !currentShipment.shippedAt
    ) {
      updateData.shippedAt = new Date();
    }

    try {
      return await this.prisma.shipment.update({
        where: { id },
        data: updateData,
        include: { warehouse: { include: { coverages: true } } },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Shipment with tracking number ${updateData.trackingNumber} already exists`,
          );
        }
      }
      throw error;
    }
  }

  async createLabel(input: CreateLabelInput) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: input.shipmentId },
      include: { warehouse: true },
    });
    if (!shipment) {
      throw new NotFoundException(
        `Shipment with ID ${input.shipmentId} not found`,
      );
    }

    let carrier = await this.prisma.carrier.findUnique({
      where: { id: shipment.carrierId },
    });
    if (!carrier)
      throw new BadRequestException(
        `Carrier with ID ${shipment.carrierId} not found`,
      );

    const order = await this.prisma.order.findUnique({
      where: { id: shipment.orderId },
      include: {
        warehouse: true,
        user: true,
      },
    });
    if (!order) {
      throw new NotFoundException(
        `Order with ID ${shipment.orderId} not found`,
      );
    }

    const originPincode =
      shipment.originPincode ??
      shipment.warehouse?.pincode ??
      order.warehouse?.pincode;
    const destinationPincode =
      shipment.destinationPincode ?? order.destinationPincode;
    if (!originPincode) {
      throw new BadRequestException('Origin pincode missing on shipment');
    }
    if (!destinationPincode) {
      throw new BadRequestException(
        'Destination pincode missing on shipment/order',
      );
    }

    const weightGrams = shipment.weightGrams ?? order.packageWeightGrams ?? 500;
    const lengthCm = shipment.lengthCm ?? order.packageLengthCm ?? undefined;
    const widthCm = shipment.widthCm ?? order.packageWidthCm ?? undefined;
    const heightCm = shipment.heightCm ?? order.packageHeightCm ?? undefined;

    // If a label already exists, return it (idempotency)
    const existing = await this.prisma.shippingLabel.findUnique({
      where: { shipmentId: shipment.id },
    });
    if (existing) return existing;

    // Rate shop can override carrier selection when policy enforces best cost/SLA
    try {
      const decision = await this.rateShop.shop({
        originPincode,
        destinationPincode,
        weightGrams,
        lengthCm,
        widthCm,
        heightCm,
        warehouseId: shipment.warehouseId ?? order.warehouseId ?? undefined,
      });
      if (decision) {
        const decided = await this.prisma.carrier.findUnique({
          where: { id: decision.carrierId },
        });
        if (decided) {
          carrier = decided;
          if (shipment.carrierId !== decided.id) {
            await this.prisma.shipment.update({
              where: { id: shipment.id },
              data: { carrierId: decided.id },
            });
            shipment.carrierId = decided.id;
          }
        }
      }
    } catch (e) {
      console.warn(
        '[ShipmentsService] Rate shop failed, using original carrier',
        (e as Error).message,
      );
    }

    const adapter =
      this.carrierAdapters.getAdapter(carrier.name) ??
      this.carrierAdapters.getAdapter('SANDBOX');

    const pickupAddress =
      (shipment.warehouse ?? order.warehouse)
        ? {
            name:
              shipment.warehouse?.name ??
              order.warehouse?.name ??
              'SwiftShip Warehouse',
            phone: '0000000000',
            addressLine1:
              shipment.warehouse?.addressLine1 ??
              order.warehouse?.addressLine1 ??
              '',
            addressLine2:
              shipment.warehouse?.addressLine2 ??
              order.warehouse?.addressLine2 ??
              undefined,
            city: shipment.warehouse?.city ?? order.warehouse?.city ?? '',
            state: shipment.warehouse?.state ?? order.warehouse?.state ?? '',
            pincode: originPincode,
            country:
              shipment.warehouse?.country ??
              order.warehouse?.country ??
              'India',
          }
        : undefined;

    const deliveryAddress = {
      name: order.destinationName ?? order.user?.name ?? 'Consignee',
      phone: order.destinationPhone ?? order.user?.email ?? 'NA',
      addressLine1: order.destinationAddressLine1 ?? 'Address unavailable',
      addressLine2: order.destinationAddressLine2 ?? undefined,
      city: order.destinationCity ?? '',
      state: order.destinationState ?? '',
      pincode: destinationPincode,
      country: order.destinationCountry ?? 'India',
    };

    const generated = await adapter!.generateLabel({
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      format: (input.format as any) ?? 'PDF',
      pickupAddress,
      deliveryAddress,
      packageDetails: {
        weight: weightGrams,
        length: lengthCm,
        width: widthCm,
        height: heightCm,
        declaredValue: order.total,
      },
      orderNumber: order.orderNumber,
      metadata: {
        orderId: order.id,
        userId: order.userId,
        warehouseId: shipment.warehouseId ?? order.warehouseId,
      },
    });
    const label = await this.prisma.shippingLabel.create({
      data: {
        shipmentId: shipment.id,
        labelNumber: generated.labelNumber,
        carrierCode: generated.carrierCode,
        serviceName: generated.serviceName ?? null,
        format: generated.format,
        status: LabelStatus.GENERATED,
        labelUrl: generated.labelUrl ?? null,
        generatedAt: new Date(),
      },
    });

    // Mark shipment as SHIPPED if it was pending
    if (shipment.status === 'PENDING') {
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { status: 'SHIPPED', shippedAt: new Date() },
      });
    }

    this.metrics.inc('labels_generated');
    return label;
  }

  async ingestTracking(input: IngestTrackingInput) {
    const shipment = await this.getShipment(input.shipmentId);
    const raw = input.rawJson ? JSON.parse(input.rawJson) : undefined;
    const event = await this.prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        trackingNumber: input.trackingNumber,
        status: input.status,
        subStatus: input.subStatus ?? null,
        description: input.description ?? null,
        eventCode: input.eventCode ?? null,
        location: input.location ?? null,
        occurredAt: new Date(input.occurredAt),
        raw: raw,
      },
    });

    // Auto-advance shipment status
    const nextStatus = this.computeNextStatus(input.status);
    if (nextStatus) {
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { status: nextStatus },
      });
    }
    return event;
  }

  private computeNextStatus(status: string): ShipmentStatus | null {
    const s = status.toLowerCase();
    if (s.includes('in transit') || s.includes('transit'))
      return 'IN_TRANSIT' as ShipmentStatus;
    if (s.includes('out for delivery')) return 'IN_TRANSIT' as ShipmentStatus;
    if (s.includes('delivered')) return 'DELIVERED' as ShipmentStatus;
    if (s.includes('shipped') || s.includes('pickup'))
      return 'SHIPPED' as ShipmentStatus;
    if (s.includes('cancel')) return 'CANCELLED' as ShipmentStatus;
    return null;
  }

  async deleteShipment(id: number): Promise<ShipmentEntity> {
    // Check if shipment exists
    await this.getShipment(id);

    // Do not allow deleting delivered shipments
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    if (shipment.status === 'DELIVERED') {
      throw new BadRequestException('Cannot delete a delivered shipment');
    }

    try {
      return await this.prisma.shipment.delete({
        where: { id },
        include: { warehouse: { include: { coverages: true } } },
      });
    } catch (error) {
      throw error;
    }
  }

  async filterShipments(
    filter: ShipmentsFilterInput,
  ): Promise<ShipmentEntity[]> {
    return this.prisma.shipment.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.orderId ? { orderId: filter.orderId } : {}),
        ...(filter.carrierId ? { carrierId: filter.carrierId } : {}),
        ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { warehouse: { include: { coverages: true } } },
    });
  }

  async getShipmentsByStatus(
    status: ShipmentStatus,
  ): Promise<ShipmentEntity[]> {
    return this.prisma.shipment.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { warehouse: { include: { coverages: true } } },
    });
  }

  async getShipmentsByOrder(orderId: number): Promise<ShipmentEntity[]> {
    // Verify that the order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return this.prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { warehouse: { include: { coverages: true } } },
    });
  }

  async countShipmentsByStatus(): Promise<Record<ShipmentStatus, number>> {
    const shipments = await this.prisma.shipment.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const result = {
      PENDING: 0,
      SHIPPED: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    shipments.forEach((shipment) => {
      result[shipment.status] = shipment._count.status;
    });

    return result;
  }
}
