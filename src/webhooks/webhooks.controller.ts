import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('carrier-webhook')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService, private readonly prisma: PrismaService) {}

  // Placeholder endpoint to receive generic carrier tracking webhooks
  @Post('tracking')
  @HttpCode(200)
  async tracking(@Body() body: any, @Headers() headers: Record<string, string>) {
    // eslint-disable-next-line no-console
    console.log('[CarrierWebhook] tracking', { headers, body });
    await this.webhooks.dispatch('tracking', body);
    try {
      // Basic mapper for Delhivery-like payloads; extend per carrier
      const shipmentId = Number(body?.shipmentId || body?.shipment_id);
      const trackingNumber = String(body?.awb || body?.tracking_number || '');
      const status = String(body?.status || body?.scan || 'EVENT');
      const description = body?.remarks || body?.description || undefined;
      const location = body?.location || undefined;
      const occurredAt = new Date(body?.scan_date || body?.occurred_at || Date.now());
      if (!Number.isNaN(shipmentId) && trackingNumber) {
        await this.prisma.trackingEvent.create({
          data: {
            shipmentId,
            trackingNumber,
            status,
            description: description ?? null,
            location: location ?? null,
            subStatus: null,
            eventCode: null,
            occurredAt,
          },
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[CarrierWebhook] tracking ingest failed', (e as Error).message);
    }
    return { ok: true };
  }
}
