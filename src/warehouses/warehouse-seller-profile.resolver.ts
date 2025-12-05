import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { WarehouseSellerProfile } from './seller-profile.model';
import { WarehouseSellerProfileService } from './warehouse-seller-profile.service';
import { CreateWarehouseSellerProfileInput } from './dto/create-seller-profile.input';
import { UpdateWarehouseSellerProfileInput } from './dto/update-seller-profile.input';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver(() => WarehouseSellerProfile)
export class WarehouseSellerProfileResolver {
  constructor(private readonly service: WarehouseSellerProfileService) {}

  @Query(() => [WarehouseSellerProfile], {
    description: 'List seller profiles configured for a warehouse',
  })
  @UseGuards(GqlAuthGuard)
  async warehouseSellerProfiles(
    @Args('warehouseId', { type: () => Int }) warehouseId: number,
  ) {
    return this.service.listForWarehouse(warehouseId);
  }

  @Mutation(() => WarehouseSellerProfile, { description: 'Create a seller profile' })
  @UseGuards(GqlAuthGuard)
  async createWarehouseSellerProfile(
    @Args('input') input: CreateWarehouseSellerProfileInput,
    @CurrentUser() user: any,
  ) {
    return this.service.create(input, user.id);
  }

  @Mutation(() => WarehouseSellerProfile, { description: 'Update a seller profile' })
  @UseGuards(GqlAuthGuard)
  async updateWarehouseSellerProfile(
    @Args('input') input: UpdateWarehouseSellerProfileInput,
  ) {
    return this.service.update(input);
  }
}
