import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { WarehousesService } from './warehouses.service';
import { Warehouse, WarehouseCoverage } from './warehouse.model';
import { CreateWarehouseInput } from './dto/create-warehouse.input';
import { UpdateWarehouseInput } from './dto/update-warehouse.input';
import { UpsertWarehouseCoverageInput } from './dto/upsert-warehouse-coverage.input';

@Resolver(() => Warehouse)
export class WarehousesResolver {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Query(() => [Warehouse], { description: 'List all warehouses' })
  warehouses() {
    return this.warehousesService.findAll();
  }

  @Query(() => Warehouse, { description: 'Get warehouse by ID' })
  warehouse(@Args('id', { type: () => Int }) id: number) {
    return this.warehousesService.findOne(id);
  }

  @Mutation(() => Warehouse, { description: 'Create a warehouse' })
  createWarehouse(@Args('input') input: CreateWarehouseInput) {
    return this.warehousesService.create(input);
  }

  @Mutation(() => Warehouse, { description: 'Update a warehouse' })
  updateWarehouse(@Args('input') input: UpdateWarehouseInput) {
    return this.warehousesService.update(input);
  }

  @Mutation(() => Boolean, { description: 'Delete a warehouse' })
  async deleteWarehouse(@Args('id', { type: () => Int }) id: number) {
    return this.warehousesService.delete(id);
  }

  @Mutation(() => WarehouseCoverage, {
    description: 'Create or update coverage for a warehouse',
  })
  upsertWarehouseCoverage(@Args('input') input: UpsertWarehouseCoverageInput) {
    return this.warehousesService.upsertCoverage(input);
  }

  @Query(() => [WarehouseCoverage], {
    description: 'List coverage for a warehouse',
  })
  warehouseCoverages(
    @Args('warehouseId', { type: () => Int }) warehouseId: number,
  ) {
    return this.warehousesService.coveragesForWarehouse(warehouseId);
  }
}
