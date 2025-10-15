import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import * as morgan from 'morgan';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Raw body for Shopify webhook signature verification
  app.use('/shopify/webhook', bodyParser.raw({ type: '*/*' }));
  // Security headers
  app.use(helmet());
  // Request logging
  app.use(morgan('combined'));
  // CORS
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  // Validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Graceful shutdown
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
