import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { WebhookDispatcher } from './workers/webhook-dispatcher';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [],
  providers: [QueuesService, WebhookDispatcher, PrismaService],
  exports: [QueuesService],
})
export class QueuesModule {}
