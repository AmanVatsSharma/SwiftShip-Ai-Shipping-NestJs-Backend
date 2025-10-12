import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from './webhooks.service';
import { WebhooksResolver } from './webhooks.resolver';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [WebhooksController],
  providers: [PrismaService, WebhooksService, WebhooksResolver],
  exports: [WebhooksService],
})
export class WebhooksModule {}
