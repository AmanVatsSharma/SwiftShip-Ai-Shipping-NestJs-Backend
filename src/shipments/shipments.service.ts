import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Shipment as ShipmentEntity, ShipmentStatus } from '@prisma/client';
import { CreateShipmentInput } from './create-shipment.input';
import { UpdateShipmentInput } from './update-shipment.input';
import { ShipmentsFilterInput } from './shipments-filter.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class ShipmentsService {
  constructor(private prisma: PrismaService) {}

  async getShipment(id: number): Promise<ShipmentEntity> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });
    
    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }
    
    return shipment;
  }

  async getShipments(): Promise<ShipmentEntity[]> {
    return this.prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createShipment(data: CreateShipmentInput): Promise<ShipmentEntity> {
    try {
      // Verify that the order exists
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId }
      });
      
      if (!order) {
        throw new BadRequestException(`Order with ID ${data.orderId} not found`);
      }
      
      // Verify that the carrier exists
      const carrier = await this.prisma.carrier.findUnique({
        where: { id: data.carrierId }
      });
      
      if (!carrier) {
        throw new BadRequestException(`Carrier with ID ${data.carrierId} not found`);
      }

      // Status validation - if shippedAt is set, status should be SHIPPED or later
      if (data.shippedAt && data.status === 'PENDING') {
        throw new BadRequestException('Status must be SHIPPED or later if shippedAt is provided');
      }
      
      // Status validation - if deliveredAt is set, status should be DELIVERED
      if (data.deliveredAt && data.status !== 'DELIVERED') {
        throw new BadRequestException('Status must be DELIVERED if deliveredAt is provided');
      }

      return this.prisma.shipment.create({
        data: {
          trackingNumber: data.trackingNumber,
          status: data.status,
          orderId: data.orderId,
          carrierId: data.carrierId,
          shippedAt: data.shippedAt,
          deliveredAt: data.deliveredAt,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Shipment with tracking number ${data.trackingNumber} already exists`);
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
    
    // Get the current state to perform validations
    const currentShipment = await this.prisma.shipment.findUnique({
      where: { id }
    });
    
    // Since we just verified the shipment exists with getShipment, currentShipment shouldn't be null
    if (!currentShipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }
    
    // Status validation - if shippedAt is set, status should be SHIPPED or later
    if ((updateData.shippedAt || currentShipment.shippedAt) && 
        updateData.status === 'PENDING') {
      throw new BadRequestException('Status cannot be PENDING if shippedAt is set');
    }
    
    // Status validation - if deliveredAt is set, status should be DELIVERED
    if ((updateData.deliveredAt || currentShipment.deliveredAt) && 
        updateData.status && updateData.status !== 'DELIVERED') {
      throw new BadRequestException('Status must be DELIVERED if deliveredAt is set');
    }
    
    // If status is changing to DELIVERED, set deliveredAt to now if not provided
    if (updateData.status === 'DELIVERED' && !updateData.deliveredAt && !currentShipment.deliveredAt) {
      updateData.deliveredAt = new Date();
    }
    
    // If status is changing to SHIPPED, set shippedAt to now if not provided
    if (updateData.status === 'SHIPPED' && !updateData.shippedAt && !currentShipment.shippedAt) {
      updateData.shippedAt = new Date();
    }
    
    try {
      return await this.prisma.shipment.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Shipment with tracking number ${updateData.trackingNumber} already exists`);
        }
      }
      throw error;
    }
  }

  async deleteShipment(id: number): Promise<ShipmentEntity> {
    // Check if shipment exists
    await this.getShipment(id);
    
    // Do not allow deleting delivered shipments
    const shipment = await this.prisma.shipment.findUnique({
      where: { id }
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
      });
    } catch (error) {
      throw error;
    }
  }

  async filterShipments(filter: ShipmentsFilterInput): Promise<ShipmentEntity[]> {
    return this.prisma.shipment.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.orderId ? { orderId: filter.orderId } : {}),
        ...(filter.carrierId ? { carrierId: filter.carrierId } : {}),
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  async getShipmentsByStatus(status: ShipmentStatus): Promise<ShipmentEntity[]> {
    return this.prisma.shipment.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  async getShipmentsByOrder(orderId: number): Promise<ShipmentEntity[]> {
    // Verify that the order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    
    return this.prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  async countShipmentsByStatus(): Promise<Record<ShipmentStatus, number>> {
    const shipments = await this.prisma.shipment.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });
    
    const result = {
      PENDING: 0,
      SHIPPED: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      CANCELLED: 0
    };
    
    shipments.forEach(shipment => {
      result[shipment.status] = shipment._count.status;
    });
    
    return result;
  }
} 