import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaService } from '../prisma/prisma.service';
import { UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PincodeZoneModel } from './pincode-zone.model';
import { CreatePincodeZoneInput } from './create-pincode-zone.input';
import { UpdatePincodeZoneInput } from './update-pincode-zone.input';

@Resolver(() => PincodeZoneModel)
export class ServiceabilityAdminResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => [PincodeZoneModel])
  async pincodeZones() {
    return this.prisma.pincodeZone.findMany();
  }

  @Mutation(() => PincodeZoneModel)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async createPincodeZone(@Args('input') input: CreatePincodeZoneInput) {
    return this.prisma.pincodeZone.create({ data: input });
  }

  @Mutation(() => PincodeZoneModel)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async updatePincodeZone(@Args('input') input: UpdatePincodeZoneInput) {
    const { id, ...data } = input;
    return this.prisma.pincodeZone.update({ where: { id }, data });
  }

  @Mutation(() => PincodeZoneModel)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async deletePincodeZone(@Args('id', { type: () => Int }) id: number) {
    return this.prisma.pincodeZone.delete({ where: { id } });
  }
}
