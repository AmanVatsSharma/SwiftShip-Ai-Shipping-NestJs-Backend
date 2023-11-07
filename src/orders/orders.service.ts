import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order as OrderEntity, OrderStatus } from '@prisma/client';
import { CreateOrderInput } from './create-order.input';
import { UpdateOrderInput } from './update-order.input';
import { OrdersFilterInput } from './orders-filter.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async getOrder(id: number): Promise<OrderEntity> {
    const order = await this.prisma.order.findUnique({ 
      where: { id },
      include: {
        shipments: true,
        returns: true
      }
    });
    
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    
    return order;
  }

  async getOrders(): Promise<OrderEntity[]> {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        shipments: true,
        returns: true
      }
    });
  }

  async createOrder(orderData: CreateOrderInput): Promise<OrderEntity> {
    try {
      // Verify that the user exists
      const user = await this.prisma.user.findUnique({
        where: { id: orderData.userId }
      });
      
      if (!user) {
        throw new BadRequestException(`User with ID ${orderData.userId} not found`);
      }
      
      // If carrierId is provided, verify that the carrier exists
      if (orderData.carrierId) {
        const carrier = await this.prisma.carrier.findUnique({
          where: { id: orderData.carrierId }
        });
        
        if (!carrier) {
          throw new BadRequestException(`Carrier with ID ${orderData.carrierId} not found`);
        }
      }

      // Set default status to PENDING if not provided
      const status = orderData.status ?? OrderStatus.PENDING;

      return await this.prisma.order.create({
        data: {
          orderNumber: orderData.orderNumber,
          total: orderData.total,
          userId: orderData.userId,
          carrierId: orderData.carrierId,
          status,
        },
        include: {
          shipments: true,
          returns: true
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Order with number ${orderData.orderNumber} already exists`);
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Invalid foreign key reference');
        }
      }
      
      throw error;
    }
  }

  async updateOrder(data: UpdateOrderInput): Promise<OrderEntity> {
    const { id, ...updateData } = data;
    
    // Check if order exists
    await this.getOrder(id);
    
    // If carrierId is provided, verify that the carrier exists
    if (updateData.carrierId) {
      const carrier = await this.prisma.carrier.findUnique({
        where: { id: updateData.carrierId }
      });
      
      if (!carrier) {
        throw new BadRequestException(`Carrier with ID ${updateData.carrierId} not found`);
      }
    }
    
    // Status transition validation
    if (updateData.status) {
      const currentOrder = await this.prisma.order.findUnique({ where: { id } });
      
      // Since we already verified the order exists above, currentOrder shouldn't be null
      if (!currentOrder) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }
      
      // Validate status transitions
      if (currentOrder.status === OrderStatus.CANCELLED && updateData.status !== OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot change status of a CANCELLED order');
      }
      
      if (currentOrder.status === OrderStatus.REFUNDED && updateData.status !== OrderStatus.REFUNDED) {
        throw new BadRequestException('Cannot change status of a REFUNDED order');
      }
    }
    
    try {
      return await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          shipments: true,
          returns: true
        }
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Order with number ${updateData.orderNumber} already exists`);
        }
      }
      throw error;
    }
  }

  async deleteOrder(id: number): Promise<OrderEntity> {
    // Check if order exists
    await this.getOrder(id);
    
    // Get current order to check if it has shipments or returns
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        shipments: true,
        returns: true
      }
    });
    
    // Since we already verified the order exists above, order shouldn't be null
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    
    // Do not allow deleting orders with shipments or returns
    if (order.shipments.length > 0) {
      throw new BadRequestException('Cannot delete an order with associated shipments');
    }
    
    if (order.returns.length > 0) {
      throw new BadRequestException('Cannot delete an order with associated returns');
    }
    
    // Do not allow deleting orders with status PAID
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Cannot delete a PAID order');
    }
    
    try {
      return await this.prisma.order.delete({
        where: { id },
      });
    } catch (error) {
      throw error;
    }
  }

  async filterOrders(filter: OrdersFilterInput): Promise<OrderEntity[]> {
    return this.prisma.order.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.carrierId ? { carrierId: filter.carrierId } : {}),
        ...(filter.orderNumber ? { orderNumber: filter.orderNumber } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        shipments: true,
        returns: true
      }
    });
  }
  
  async getOrdersByUser(userId: number): Promise<OrderEntity[]> {
    // Verify that the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        shipments: true,
        returns: true
      }
    });
  }
  
  async getOrdersByStatus(status: OrderStatus): Promise<OrderEntity[]> {
    return this.prisma.order.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        shipments: true,
        returns: true
      }
    });
  }
  
  async countOrdersByStatus(): Promise<Record<OrderStatus, number>> {
    const orders = await this.prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });
    
    const result = {
      PENDING: 0,
      PAID: 0,
      CANCELLED: 0,
      REFUNDED: 0
    };
    
    orders.forEach(order => {
      result[order.status] = order._count.status;
    });
    
    return result;
  }

  async getTotalSales(): Promise<number> {
    const result = await this.prisma.order.aggregate({
      _sum: {
        total: true
      },
      where: {
        status: OrderStatus.PAID
      }
    });
    
    return result._sum.total || 0;
  }
} 