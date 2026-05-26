import { Controller, Get, UseGuards } from '@nestjs/common';
import { DriveService } from './drive.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('drive')
@UseGuards(JwtAuthGuard)
export class DriveController {
  constructor(private readonly driveService: DriveService, private readonly prisma: PrismaService) {}

@Get('quota')
@UseGuards(JwtAuthGuard)
async getStorageQuota(@CurrentUser('id') userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return this.driveService.getStorageQuota(
    user.googleAccessToken || '',
    user.googleRefreshToken || '',
  );
}
}