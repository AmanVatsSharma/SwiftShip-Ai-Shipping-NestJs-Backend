import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Return as ReturnEntity, ReturnStatus } from '@prisma/client';
import { CreateReturnInput } from './create-return.input';
import { UpdateReturnInput } from './update-return.input';
import { ReturnsFilterInput } from './returns-filter.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  async getReturn(id: number): Promise<ReturnEntity> {
    const returnEntity = await this.prisma.return.findUnique({ where: { id } });
    
    if (!returnEntity) {
      throw new NotFoundException(`Return with ID ${id} not found`);
    }
    
    return returnEntity;
  }

  async getReturns(): Promise<ReturnEntity[]> {
    return this.prisma.return.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createReturn(data: CreateReturnInput): Promise<ReturnEntity> {
    try {
      // Verify that the order exists
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId }
      });
      
      if (!order) {
        throw new BadRequestException(`Order with ID ${data.orderId} not found`);
      }
      
      // Status validation - only allow REQUESTED status for new returns
      if (data.status !== ReturnStatus.REQUESTED) {
        throw new BadRequestException('New returns must have status REQUESTED');
      }

      return await this.prisma.return.create({
        data: { ...data }
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Return with number ${data.returnNumber} already exists`);
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Invalid foreign key reference');
        }
      }
      
      throw error;
    }
  }

  async updateReturn(data: UpdateReturnInput): Promise<ReturnEntity> {
    const { id, ...updateData } = data;
    
    // Check if return exists
    await this.getReturn(id);
    
    // Get the current state to perform validations
    const currentReturn = await this.prisma.return.findUnique({
      where: { id }
    });
    
    if (!currentReturn) {
      throw new NotFoundException(`Return with ID ${id} not found`);
    }
    
    // Status transition validation
    if (updateData.status) {
      // Validate status transitions based on current status
      switch (currentReturn.status) {
        case ReturnStatus.COMPLETED:
          throw new BadRequestException('Cannot update a COMPLETED return');
        case ReturnStatus.CANCELLED:
          throw new BadRequestException('Cannot update a CANCELLED return');
        case ReturnStatus.REJECTED:
          if (updateData.status !== ReturnStatus.CANCELLED) {
            throw new BadRequestException('REJECTED returns can only be changed to CANCELLED');
          }
          break;
        case ReturnStatus.REQUESTED:
          // REQUESTED can transition to any status except COMPLETED
          if (updateData.status === ReturnStatus.COMPLETED) {
            throw new BadRequestException('Returns must be APPROVED before they can be COMPLETED');
          }
          break;
        case ReturnStatus.APPROVED:
          // APPROVED can only transition to COMPLETED or CANCELLED
          if (updateData.status !== ReturnStatus.COMPLETED && 
              updateData.status !== ReturnStatus.CANCELLED) {
            throw new BadRequestException('APPROVED returns can only change to COMPLETED or CANCELLED');
          }
          break;
      }
    }
    
    try {
      return await this.prisma.return.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Return with number ${updateData.returnNumber} already exists`);
        }
      }
      throw error;
    }
  }

  async deleteReturn(id: number): Promise<ReturnEntity> {
    // Check if return exists
    await this.getReturn(id);
    
    // Get the current state to perform validations
    const currentReturn = await this.prisma.return.findUnique({
      where: { id }
    });
    
    if (!currentReturn) {
      throw new NotFoundException(`Return with ID ${id} not found`);
    }
    
    // Do not allow deleting completed or approved returns
    if (currentReturn.status === ReturnStatus.COMPLETED || 
        currentReturn.status === ReturnStatus.APPROVED) {
      throw new BadRequestException(`Cannot delete a return with status ${currentReturn.status}`);
    }
    
    try {
      return await this.prisma.return.delete({
        where: { id },
      });
    } catch (error) {
      throw error;
    }
  }

  async filterReturns(filter: ReturnsFilterInput): Promise<ReturnEntity[]> {
    return this.prisma.return.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.orderId ? { orderId: filter.orderId } : {}),
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  async getReturnsByStatus(status: ReturnStatus): Promise<ReturnEntity[]> {
    return this.prisma.return.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  async getReturnsByOrder(orderId: number): Promise<ReturnEntity[]> {
    // Verify that the order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    
    return this.prisma.return.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  async countReturnsByStatus(): Promise<Record<ReturnStatus, number>> {
    const returns = await this.prisma.return.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });
    
    const result = {
      REQUESTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      COMPLETED: 0,
      CANCELLED: 0
    };
    
    returns.forEach(ret => {
      result[ret.status] = ret._count.status;
    });
    
    return result;
  }
} 