import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Security headers
  app.use(helmet());
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
