import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Carrier } from './carrier.model';
import { CarrierService } from './carrier.service';
import { CreateCarrierInput } from './create-carrier.input';
import { UpdateCarrierInput } from './update-carrier.input';
import { UseGuards } from '@nestjs/common';

@Resolver(() => Carrier)
export class CarrierResolver {
  constructor(private carrierService: CarrierService) {}

  /**
   * Get all carriers in the system
   * @returns Array of carrier objects
   */
  @Query(() => [Carrier], { 
    name: 'carriers',
    description: 'Get all shipping carriers' 
  })
  async getCarriers(): Promise<Carrier[]> {
    return this.carrierService.getCarriers();
  }

  /**
   * Get a specific carrier by ID
   * @param id - The ID of the carrier to retrieve
   * @returns Carrier object if found
   */
  @Query(() => Carrier, { 
    name: 'carrier',
    description: 'Get a carrier by ID' 
  })
  async getCarrier(
    @Args('id', { type: () => Int, description: 'The ID of the carrier' }) 
    id: number
  ): Promise<Carrier> {
    return this.carrierService.getCarrier(id);
  }

  /**
   * Create a new carrier
   * @param createCarrierInput - The carrier data to create
   * @returns The newly created carrier
   */
  @Mutation(() => Carrier, {
    description: 'Create a new shipping carrier'
  })
  async createCarrier(
    @Args('createCarrierInput', { description: 'Carrier creation data' }) 
    createCarrierInput: CreateCarrierInput
  ): Promise<Carrier> {
    return this.carrierService.createCarrier(createCarrierInput);
  }

  /**
   * Update an existing carrier
   * @param updateCarrierInput - The carrier data to update
   * @returns The updated carrier
   */
  @Mutation(() => Carrier, {
    description: 'Update an existing shipping carrier'
  })
  async updateCarrier(
    @Args('updateCarrierInput', { description: 'Carrier update data' }) 
    updateCarrierInput: UpdateCarrierInput
  ): Promise<Carrier> {
    return this.carrierService.updateCarrier(updateCarrierInput);
  }

  /**
   * Delete a carrier by ID
   * @param id - The ID of the carrier to delete
   * @returns The deleted carrier
   */
  @Mutation(() => Carrier, {
    description: 'Delete a shipping carrier'
  })
  async deleteCarrier(
    @Args('id', { type: () => Int, description: 'The ID of the carrier to delete' }) 
    id: number
  ): Promise<Carrier> {
    return this.carrierService.deleteCarrier(id);
  }
} 