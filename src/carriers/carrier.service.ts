import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Carrier } from '@prisma/client';
import { CreateCarrierInput } from './create-carrier.input';
import { UpdateCarrierInput } from './update-carrier.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class CarrierService {
  constructor(private prisma: PrismaService) {}

  async getCarrier(id: number): Promise<Carrier> {
    const carrier = await this.prisma.carrier.findUnique({ where: { id } });
    
    if (!carrier) {
      throw new NotFoundException(`Carrier with ID ${id} not found`);
    }
    
    return carrier;
  }

  async getCarriers(): Promise<Carrier[]> {
    return this.prisma.carrier.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createCarrier(data: CreateCarrierInput): Promise<Carrier> {
    try {
      return await this.prisma.carrier.create({
        data,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Carrier with name "${data.name}" already exists`);
      }
      throw error;
    }
  }

  async updateCarrier(data: UpdateCarrierInput): Promise<Carrier> {
    const { id, ...updateData } = data;
    
    // Check if carrier exists
    await this.getCarrier(id);
    
    try {
      return await this.prisma.carrier.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Carrier with name "${updateData.name}" already exists`);
      }
      throw error;
    }
  }

  async deleteCarrier(id: number): Promise<Carrier> {
    // Check if carrier exists
    await this.getCarrier(id);
    
    try {
      return await this.prisma.carrier.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          `Cannot delete carrier with ID ${id} because it is referenced by other records`
        );
      }
      throw error;
    }
  }
} 