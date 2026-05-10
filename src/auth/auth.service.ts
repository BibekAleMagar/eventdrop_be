import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import * as bcrypt from 'bcrypt';
import { UserService } from '..//user/user.service.js';
import { AuthenticatedUser } from 'src/types/authenticate-user.type.js';
import { OAuth2Client } from 'google-auth-library';

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

    if (!user) {
      return null;
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Account was created via Google Sign-In. Please use that method.',
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return null;
    }

    return user;
  }

  async loginLocal(user: AuthenticatedUser) {
    return this.issueTokens(user);
  }

  async loginGoogleToken(idToken: string) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new UnauthorizedException('Invalid Google token');

    const user = await this.usersService.upsertGoogleUser({
      googleId: payload.sub,
      email: payload.email!,
      displayName: payload.name ?? payload.email!,
      avatarUrl: payload.picture,
      googleAccessToken: idToken,
      googleRefreshToken: undefined,
      googleTokenExpiry: undefined,
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
      user: { id: user.id, email: user.email, username: user.displayName },
    };
  }
}
