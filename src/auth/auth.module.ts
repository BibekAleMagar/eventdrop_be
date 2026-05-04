// src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategy/jwt.strategy.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const secret = config.get<string>('JWT_SECRET');
    const expiresIn = config.get<string>('JWT_EXPIRES_IN') || '1d';

    if (!secret) {
      throw new Error('JWT_SECRET is not defined in .env');
    }

    return {
      secret: secret,
      signOptions: {
        // We cast 'expiresIn' as any or StringValue to satisfy the type checker
        expiresIn: expiresIn as any, 
      },
    };
  },
}),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
