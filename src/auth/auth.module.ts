import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthResolver } from './auth.resolver';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: async (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: { expiresIn: cfg.get<number>('JWT_EXPIRES_IN_MS') ?? cfg.get<string>('JWT_EXPIRES_IN', '15m') as any },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, AuthResolver],
  exports: [AuthService],
})
export class AuthModule {}
