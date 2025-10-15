import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { WebhookDispatcher } from './workers/webhook-dispatcher';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentsModule } from '../shipments/shipments.module';
import { LabelGenerator } from './workers/label-generator';

@Module({
  imports: [ShipmentsModule],
  providers: [QueuesService, WebhookDispatcher, LabelGenerator, PrismaService],
  exports: [QueuesService, LabelGenerator],
})
export class QueuesModule {}
