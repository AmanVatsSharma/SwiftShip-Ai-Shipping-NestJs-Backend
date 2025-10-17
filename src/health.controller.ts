import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { PrismaService } from './prisma/prisma.service';
import { MetricsService } from './metrics/metrics.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private metrics: MetricsService,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    // Simplified DB ping via a trivial query; tolerates startup without DB
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch (e: any) {
      return { status: 'degraded', db: 'down', error: e?.message };
    }
  }
  
  @Get('metrics')
  getMetrics() {
    return this.metrics.snapshot();
  }
}
