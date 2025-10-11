import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('shopify')
export class ShopifyWebhookController {
  constructor(private readonly config: ConfigService) {}

  @Post('webhook')
  handleWebhook(
    @Headers('x-shopify-hmac-sha256') hmac: string,
    @Headers('x-shopify-topic') topic: string,
    @Req() req: Request,
  ) {
    if (!hmac) throw new BadRequestException('Missing HMAC header');
    const secret = this.config.get<string>('ecommerceIntegrations.shopify.apiSecret') ?? '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    if (computed !== hmac) throw new BadRequestException('Invalid HMAC');

    // TODO: dispatch to handlers based on topic
    return { ok: true };
  }
}
