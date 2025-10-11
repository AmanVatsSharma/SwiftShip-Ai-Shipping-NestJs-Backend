import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';

@Controller('shopify')
export class ShopifyController {
  constructor(private readonly config: ConfigService) {}

  @Get('oauth/start')
  start(@Query('shop') shop: string, @Res() res: Response) {
    if (!shop) throw new BadRequestException('Missing shop param');
    const appUrl = this.config.get<string>('ecommerceIntegrations.shopify.appUrl') ?? '';
    const apiKey = this.config.get<string>('ecommerceIntegrations.shopify.apiKey') ?? '';
    const scopes = this.config.get<string>('ecommerceIntegrations.shopify.scopes') ?? '';
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = encodeURIComponent(`${appUrl}/shopify/oauth/callback`);
    const url = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${redirectUri}&state=${state}`;
    res.redirect(url);
  }

  @Get('oauth/callback')
  callback(
    @Query('shop') shop: string,
    @Query('code') code: string,
    @Query('hmac') hmac: string,
    @Res() res: Response,
  ) {
    if (!shop || !code || !hmac) throw new BadRequestException('Missing params');
    const secret = this.config.get<string>('ecommerceIntegrations.shopify.apiSecret') ?? '';
    const params = new URLSearchParams({ shop, code });
    const message = params.toString();
    const computed = crypto.createHmac('sha256', secret).update(message).digest('hex');
    if (computed !== hmac) throw new BadRequestException('Invalid HMAC');

    // Normally exchange code for access token here
    // For MVP, just redirect to success page
    res.redirect('/graphql');
  }
}
