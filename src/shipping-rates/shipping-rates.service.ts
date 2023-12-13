import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingRate as ShippingRateEntity } from '@prisma/client';
import { CreateShippingRateInput } from './create-shipping-rate.input';
import { UpdateShippingRateInput } from './update-shipping-rate.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class ShippingRatesService {
  constructor(private prisma: PrismaService) {}

  async getShippingRate(id: number): Promise<ShippingRateEntity> {
    const shippingRate = await this.prisma.shippingRate.findUnique({ where: { id } });
    
    if (!shippingRate) {
      throw new NotFoundException(`Shipping rate with ID ${id} not found`);
    }
    
    return shippingRate;
  }

  async getShippingRates(): Promise<ShippingRateEntity[]> {
    return this.prisma.shippingRate.findMany({
      orderBy: [
        { carrierId: 'asc' },
        { rate: 'asc' }
      ]
    });
  }

  async getShippingRatesByCarrier(carrierId: number): Promise<ShippingRateEntity[]> {
    // Verify the carrier exists first
    const carrier = await this.prisma.carrier.findUnique({ where: { id: carrierId } });
    if (!carrier) {
      throw new NotFoundException(`Carrier with ID ${carrierId} not found`);
    }

    return this.prisma.shippingRate.findMany({
      where: { carrierId },
      orderBy: { rate: 'asc' }
    });
  }

  async createShippingRate(data: CreateShippingRateInput): Promise<ShippingRateEntity> {
    try {
      // Verify the carrier exists first
      const carrier = await this.prisma.carrier.findUnique({ 
        where: { id: data.carrierId } 
      });
      
      if (!carrier) {
        throw new BadRequestException(`Carrier with ID ${data.carrierId} not found`);
      }

      return await this.prisma.shippingRate.create({
        data,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Shipping rate for service "${data.serviceName}" already exists for this carrier`);
        }
        if (error.code === 'P2003') {
          throw new BadRequestException(`Invalid carrier ID: ${data.carrierId}`);
        }
      }
      
      throw error;
    }
  }

  async updateShippingRate(data: UpdateShippingRateInput): Promise<ShippingRateEntity> {
    const { id, ...updateData } = data;
    
    // Check if shipping rate exists
    await this.getShippingRate(id);
    
    // If carrier ID is being updated, verify it exists
    if (updateData.carrierId) {
      const carrier = await this.prisma.carrier.findUnique({ 
        where: { id: updateData.carrierId } 
      });
      
      if (!carrier) {
        throw new BadRequestException(`Carrier with ID ${updateData.carrierId} not found`);
      }
    }
    
    try {
      return await this.prisma.shippingRate.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Shipping rate for service "${updateData.serviceName}" already exists for this carrier`);
        }
        if (error.code === 'P2003') {
          throw new BadRequestException(`Invalid carrier ID: ${updateData.carrierId}`);
        }
      }
      throw error;
    }
  }

  async deleteShippingRate(id: number): Promise<ShippingRateEntity> {
    // Check if shipping rate exists
    await this.getShippingRate(id);
    
    try {
      return await this.prisma.shippingRate.delete({
        where: { id },
      });
    } catch (error) {
      throw error;
    }
  }

  async getCheapestRate(): Promise<ShippingRateEntity | null> {
    const rates = await this.prisma.shippingRate.findMany({
      orderBy: { rate: 'asc' },
      take: 1
    });
    
    return rates.length > 0 ? rates[0] : null;
  }

  async getFastestRate(): Promise<ShippingRateEntity | null> {
    const rates = await this.prisma.shippingRate.findMany({
      orderBy: { estimatedDeliveryDays: 'asc' },
      take: 1
    });
    
    return rates.length > 0 ? rates[0] : null;
  }

  async getBestValueRate(): Promise<ShippingRateEntity | null> {
    // Get all rates
    const rates = await this.prisma.shippingRate.findMany();
    if (rates.length === 0) return null;
    
    // Calculate a "value score" (lower is better) for each rate
    // Value = rate * estimatedDeliveryDays
    const ratesWithValue = rates.map(rate => ({
      ...rate,
      value: rate.rate * rate.estimatedDeliveryDays
    }));
    
    // Sort by value score (ascending)
    ratesWithValue.sort((a, b) => a.value - b.value);
    
    // Return the rate with the best value
    return ratesWithValue[0];
  }
} 