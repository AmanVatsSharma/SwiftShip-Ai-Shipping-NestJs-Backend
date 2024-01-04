import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnsResolver } from './returns.resolver';
import { ReturnsService } from './returns.service';

@Module({
  providers: [ReturnsResolver, ReturnsService, PrismaService],
  exports: [ReturnsService],
})
export class ReturnsModule {} 