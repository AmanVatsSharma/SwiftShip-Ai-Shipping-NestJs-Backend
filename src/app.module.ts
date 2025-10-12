import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { AppService } from './app.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AppResolver } from './app.resolver';
import { PrismaService } from './prisma/prisma.service';
import { OrdersModule } from './orders/orders.module';
import { CarriersModule } from './carriers/carriers.module';
import { ShippingRatesModule } from './shipping-rates/shipping-rates.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { ReturnsModule } from './returns/returns.module';
import { PluginsModule } from './plugins/plugins.module';
import { RolesModule } from './users/roles.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().uri().required(),
        CORS_ORIGIN: Joi.string().optional(),
        SHOPIFY_API_KEY: Joi.string().optional(),
        SHOPIFY_API_SECRET: Joi.string().optional(),
        SHOPIFY_APP_URL: Joi.string().uri().optional(),
        SHOPIFY_SCOPES: Joi.string().optional(),
        JWT_SECRET: Joi.string().default('dev-secret'),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.graphql'),
      playground: process.env.NODE_ENV !== 'production',
      context: ({ req }) => ({ req }),
    }),
    OrdersModule,
    CarriersModule,
    ShippingRatesModule,
    ShipmentsModule,
    ReturnsModule,
    PluginsModule,
    RolesModule,
    AuthModule,
    OnboardingModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    AppResolver,
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
