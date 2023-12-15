import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ShippingRate } from './shipping-rate.model';
import { ShippingRatesService } from './shipping-rates.service';
import { CreateShippingRateInput } from './create-shipping-rate.input';
import { UpdateShippingRateInput } from './update-shipping-rate.input';

@Resolver(() => ShippingRate)
export class ShippingRatesResolver {
  constructor(private shippingRatesService: ShippingRatesService) {}

  /**
   * Get all shipping rates in the system
   * @returns Array of shipping rate objects
   */
  @Query(() => [ShippingRate], { 
    name: 'shippingRates',
    description: 'Get all shipping rates ordered by carrier and rate' 
  })
  async getShippingRates(): Promise<ShippingRate[]> {
    return this.shippingRatesService.getShippingRates();
  }

  /**
   * Get a specific shipping rate by ID
   * @param id - The ID of the shipping rate to retrieve
   * @returns Shipping rate object
   */
  @Query(() => ShippingRate, { 
    name: 'shippingRate',
    description: 'Get a shipping rate by ID' 
  })
  async getShippingRate(
    @Args('id', { type: () => Int, description: 'The ID of the shipping rate' }) 
    id: number
  ): Promise<ShippingRate> {
    return this.shippingRatesService.getShippingRate(id);
  }

  /**
   * Get all shipping rates for a specific carrier
   * @param carrierId - The ID of the carrier to get rates for
   * @returns Array of shipping rate objects
   */
  @Query(() => [ShippingRate], { 
    name: 'shippingRatesByCarrier',
    description: 'Get all shipping rates for a specific carrier' 
  })
  async getShippingRatesByCarrier(
    @Args('carrierId', { type: () => Int, description: 'The ID of the carrier' }) 
    carrierId: number
  ): Promise<ShippingRate[]> {
    return this.shippingRatesService.getShippingRatesByCarrier(carrierId);
  }

  /**
   * Get the cheapest shipping rate
   * @returns The cheapest shipping rate or null if none exist
   */
  @Query(() => ShippingRate, { 
    name: 'cheapestShippingRate',
    description: 'Get the cheapest shipping rate',
    nullable: true 
  })
  async getCheapestRate(): Promise<ShippingRate | null> {
    return this.shippingRatesService.getCheapestRate();
  }

  /**
   * Get the fastest shipping rate
   * @returns The fastest shipping rate or null if none exist
   */
  @Query(() => ShippingRate, { 
    name: 'fastestShippingRate',
    description: 'Get the fastest shipping rate',
    nullable: true 
  })
  async getFastestRate(): Promise<ShippingRate | null> {
    return this.shippingRatesService.getFastestRate();
  }

  /**
   * Get the best value shipping rate (balancing cost and speed)
   * @returns The best value shipping rate or null if none exist
   */
  @Query(() => ShippingRate, { 
    name: 'bestValueShippingRate',
    description: 'Get the best value shipping rate (balancing cost and speed)',
    nullable: true 
  })
  async getBestValueRate(): Promise<ShippingRate | null> {
    return this.shippingRatesService.getBestValueRate();
  }

  /**
   * Create a new shipping rate
   * @param createShippingRateInput - The shipping rate data to create
   * @returns The newly created shipping rate
   */
  @Mutation(() => ShippingRate, {
    description: 'Create a new shipping rate'
  })
  async createShippingRate(
    @Args('createShippingRateInput', { description: 'Shipping rate creation data' }) 
    createShippingRateInput: CreateShippingRateInput
  ): Promise<ShippingRate> {
    return this.shippingRatesService.createShippingRate(createShippingRateInput);
  }

  /**
   * Update an existing shipping rate
   * @param updateShippingRateInput - The shipping rate data to update
   * @returns The updated shipping rate
   */
  @Mutation(() => ShippingRate, {
    description: 'Update an existing shipping rate'
  })
  async updateShippingRate(
    @Args('updateShippingRateInput', { description: 'Shipping rate update data' }) 
    updateShippingRateInput: UpdateShippingRateInput
  ): Promise<ShippingRate> {
    return this.shippingRatesService.updateShippingRate(updateShippingRateInput);
  }

  /**
   * Delete a shipping rate by ID
   * @param id - The ID of the shipping rate to delete
   * @returns The deleted shipping rate
   */
  @Mutation(() => ShippingRate, {
    description: 'Delete a shipping rate'
  })
  async deleteShippingRate(
    @Args('id', { type: () => Int, description: 'The ID of the shipping rate to delete' }) 
    id: number
  ): Promise<ShippingRate> {
    return this.shippingRatesService.deleteShippingRate(id);
  }
} 