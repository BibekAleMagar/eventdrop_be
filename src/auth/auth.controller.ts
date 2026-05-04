import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from '../common/decorator/public.decorator.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Email / Password ───────────────────────────────────────────────────────

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  login(@Req() req: any, @Body() _dto: LoginDto) {
    return this.authService.loginLocal(req.user);
  }

  // ─── Google OAuth2 ──────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google automatically
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authService.loginGoogle(req.user);
    // In production redirect to your frontend with the token
    const frontendUrl = this.configService.get('app.url');
    return res.redirect(
      `${frontendUrl}/auth/success?token=${result.accessToken}`,
    );
  }

  // ─── Session info ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }
}
