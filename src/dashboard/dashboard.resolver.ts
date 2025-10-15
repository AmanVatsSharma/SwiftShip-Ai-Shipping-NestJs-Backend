import { Query, Resolver } from '@nestjs/graphql';
import { PrismaService } from '../prisma/prisma.service';

@Resolver()
export class DashboardResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => String, { description: 'SLA metrics summary as JSON' })
  async slaMetrics() {
    const total = await this.prisma.shipment.count();
    const delivered = await this.prisma.shipment.count({ where: { status: 'DELIVERED' as any } });
    const inTransit = await this.prisma.shipment.count({ where: { status: 'IN_TRANSIT' as any } });
    const shipped = await this.prisma.shipment.count({ where: { status: 'SHIPPED' as any } });
    return JSON.stringify({ total, delivered, inTransit, shipped });
  }

  @Query(() => String, { description: 'Courier scorecard summary as JSON' })
  async courierScorecards() {
    const groups = await this.prisma.shipment.groupBy({ by: ['carrierId', 'status'], _count: { status: true } });
    return JSON.stringify(groups);
  }
}
