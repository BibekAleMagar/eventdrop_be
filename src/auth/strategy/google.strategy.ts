import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service.js';
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UserService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/drive.file'],
    } as any);
  }

  authenticate(req: any, options?: any) {
    super.authenticate(req, {
      ...options,
      accessType: 'offline',
      prompt: 'consent',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    console.log('accessToken:', accessToken);
    console.log('refreshToken:', refreshToken); //
    const { id, emails, displayName, photos } = profile;

    const tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now

    const user = await this.usersService.upsertGoogleUser({
      googleId: id,
      email: emails[0].value,
      displayName,
      avatarUrl: photos?.[0]?.value,
      googleAccessToken: accessToken,
      googleRefreshToken: refreshToken,
      googleTokenExpiry: tokenExpiry,
    });

    done(null, user);
  }
}
