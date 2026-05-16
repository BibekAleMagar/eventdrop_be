import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service.js';
import { AuthenticatedUser } from 'src/types/authenticate-user.type.js';
import { google } from 'googleapis';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.password) {
      throw new BadRequestException('Password is required for email signup');
    }
    const user = await this.usersService.create(dto);
    return this.issueTokens(user);
  }

  async validateLocalUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Account was created via Google Sign-In. Please use that method.',
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) return null;

    return user;
  }

  async loginLocal(user: AuthenticatedUser) {
    return this.issueTokens(user);
  }

  async loginGoogleToken(payloadData: { idToken: string; serverAuthCode: string }) {
    const { idToken, serverAuthCode } = payloadData;

    if (!serverAuthCode) {
      throw new BadRequestException('Server authentication code (serverAuthCode) is required from mobile client');
    }

    // Initialize OAuth2 client using Server Client ID and Server Secret
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    let googleTokens;
    try {
      // Exchange the one-time code for permanent tokens (access_token + refresh_token)
      const tokenResponse = await oauth2Client.getToken(serverAuthCode);
      googleTokens = tokenResponse.tokens;
      
      console.log('====== GOOGLE API TOKEN RESPONSE ======');
      console.log('Found Refresh Token?:', !!googleTokens.refresh_token);
      console.log('=======================================');
    } catch (error: any) {
      console.error('Failed to exchange serverAuthCode:', error);
      throw new UnauthorizedException(`Google code exchange failed: ${error.message}`);
    }

    // Verify identity and decrypt user profile info from ID token
    let ticket;
    try {
      ticket = await oauth2Client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid Google ID Token');
    }

    const payload = ticket.getPayload();
    if (!payload) throw new UnauthorizedException('Invalid Google token payload');

    const expiryDate = googleTokens.expiry_date ? new Date(googleTokens.expiry_date) : undefined;

    // Persist or update profile with token records safely
    const user = await this.usersService.upsertGoogleUser({
      googleId: payload.sub,
      email: payload.email!,
      displayName: payload.name ?? payload.email!,
      avatarUrl: payload.picture,
      googleAccessToken: googleTokens.access_token ?? idToken,
      googleRefreshToken: googleTokens.refresh_token, // Saved safely here
      googleTokenExpiry: expiryDate,
    });

    return this.issueTokens(user);
  }

  async loginGoogle(user: any) {
    return this.issueTokens(user);
  }

  issueTokens(user: AuthenticatedUser) {
    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, username: user.displayName, photoUrl: user.avatarUrl },
    };
  }
}