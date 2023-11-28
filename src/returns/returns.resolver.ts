import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Return, ReturnStatus } from './return.model';
import { ReturnsService } from './returns.service';
import { CreateReturnInput } from './create-return.input';
import { UpdateReturnInput } from './update-return.input';
import { ReturnsFilterInput } from './returns-filter.input';

@Resolver(() => Return)
export class ReturnsResolver {
  constructor(private readonly returnsService: ReturnsService) {}

  /**
   * Get all returns in the system
   * @returns Array of return objects
   */
  @Query(() => [Return], { 
    name: 'returns',
    description: 'Get all returns ordered by creation date (newest first)' 
  })
  async getReturns(): Promise<Return[]> {
    const returnsData = await this.returnsService.getReturns();
    return returnsData.map(ret => this.mapReturn(ret));
  }

  /**
   * Get a specific return by ID
   * @param id - The ID of the return to retrieve
   * @returns Return object
   */
  @Query(() => Return, { 
    name: 'return',
    description: 'Get a specific return by ID' 
  })
  async getReturn(
    @Args('id', { type: () => Int, description: 'The ID of the return' }) 
    id: number
  ): Promise<Return> {
    const ret = await this.returnsService.getReturn(id);
    return this.mapReturn(ret);
  }

  /**
   * Create a new return
   * @param createReturnInput - The return data to create
   * @returns The newly created return
   */
  @Mutation(() => Return, {
    description: 'Create a new return request'
  })
  async createReturn(
    @Args('createReturnInput', { description: 'Return creation data' }) 
    createReturnInput: CreateReturnInput
  ): Promise<Return> {
    const ret = await this.returnsService.createReturn(createReturnInput);
    return this.mapReturn(ret);
  }

  /**
   * Update an existing return
   * @param updateReturnInput - The return data to update
   * @returns The updated return
   */
  @Mutation(() => Return, {
    description: 'Update an existing return'
  })
  async updateReturn(
    @Args('updateReturnInput', { description: 'Return update data' }) 
    updateReturnInput: UpdateReturnInput
  ): Promise<Return> {
    const ret = await this.returnsService.updateReturn(updateReturnInput);
    return this.mapReturn(ret);
  }

  /**
   * Delete a return by ID
   * @param id - The ID of the return to delete
   * @returns The deleted return
   */
  @Mutation(() => Return, {
    description: 'Delete a return (only allowed for returns with status REQUESTED or REJECTED)'
  })
  async deleteReturn(
    @Args('id', { type: () => Int, description: 'The ID of the return to delete' }) 
    id: number
  ): Promise<Return> {
    const ret = await this.returnsService.deleteReturn(id);
    return this.mapReturn(ret);
  }

  /**
   * Filter returns based on specific criteria
   * @param filter - The filter criteria
   * @returns Array of returns matching the criteria
   */
  @Query(() => [Return], { 
    name: 'filterReturns',
    description: 'Filter returns based on status or order ID'
  })
  async filterReturns(
    @Args('returnsFilterInput', { description: 'Filter criteria for returns' }) 
    filter: ReturnsFilterInput
  ): Promise<Return[]> {
    const returns = await this.returnsService.filterReturns(filter);
    return returns.map(ret => this.mapReturn(ret));
  }

  /**
   * Get returns by status
   * @param status - The status to filter by
   * @returns Array of returns with the specified status
   */
  @Query(() => [Return], { 
    name: 'returnsByStatus',
    description: 'Get returns by status'
  })
  async getReturnsByStatus(
    @Args('status', { type: () => ReturnStatus, description: 'The status to filter by' }) 
    status: ReturnStatus
  ): Promise<Return[]> {
    const returns = await this.returnsService.getReturnsByStatus(status);
    return returns.map(ret => this.mapReturn(ret));
  }

  /**
   * Get returns by order ID
   * @param orderId - The order ID to filter by
   * @returns Array of returns for the specified order
   */
  @Query(() => [Return], { 
    name: 'returnsByOrder',
    description: 'Get returns by order ID'
  })
  async getReturnsByOrder(
    @Args('orderId', { type: () => Int, description: 'The order ID to filter by' }) 
    orderId: number
  ): Promise<Return[]> {
    const returns = await this.returnsService.getReturnsByOrder(orderId);
    return returns.map(ret => this.mapReturn(ret));
  }

  /**
   * Get counts of returns by status
   * @returns Record with counts for each status
   */
  @Query(() => String, { 
    name: 'returnCountsByStatus',
    description: 'Get counts of returns by status'
  })
  async getReturnCountsByStatus(): Promise<string> {
    const counts = await this.returnsService.countReturnsByStatus();
    return JSON.stringify(counts);
  }

  /**
   * Map a Prisma return entity to a GraphQL return type
   * @param ret - The return entity from Prisma
   * @returns A GraphQL return type
   */
  private mapReturn(ret: any): Return {
    return {
      id: ret.id,
      returnNumber: ret.returnNumber,
      status: ret.status,
      reason: ret.reason,
      pickupScheduledAt: ret.pickupScheduledAt,
      orderId: ret.orderId,
      createdAt: ret.createdAt,
      updatedAt: ret.updatedAt,
    };
  }
} 