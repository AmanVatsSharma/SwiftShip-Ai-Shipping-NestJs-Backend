import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('carrier-webhook')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  // Placeholder endpoint to receive generic carrier tracking webhooks
  @Post('tracking')
  @HttpCode(200)
  async tracking(@Body() body: any, @Headers() headers: Record<string, string>) {
    // eslint-disable-next-line no-console
    console.log('[CarrierWebhook] tracking', { headers, body });
    await this.webhooks.dispatch('tracking', body);
    return { ok: true };
  }
}
