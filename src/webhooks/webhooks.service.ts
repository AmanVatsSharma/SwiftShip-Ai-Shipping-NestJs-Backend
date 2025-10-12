import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(userId: number, event: string, targetUrl: string, secret?: string) {
    return this.prisma.webhookSubscription.create({ data: { userId, event, targetUrl, secret } });
  }

  async dispatch(event: string, payload: any) {
    const subs = await this.prisma.webhookSubscription.findMany({ where: { event, active: true } });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await axios.post(s.targetUrl, payload, { timeout: 5000 });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Webhook dispatch failed', s.targetUrl, e.message);
        }
      })
    );
  }
}
