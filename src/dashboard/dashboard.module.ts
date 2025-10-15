import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardResolver } from './dashboard.resolver';

@Module({
  providers: [PrismaService, DashboardResolver],
})
export class DashboardModule {}