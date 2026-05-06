import {
  Controller,
  Post,
  Body,
  UseGuards,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventService } from './event.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Body() dto: CreateEventDto, @CurrentUser('id') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { googleAccessToken: true },
    });

    if (!user || !user.googleAccessToken) {
      throw new UnauthorizedException(
        'Google Drive access not found. Please log in with Google again.',
      );
    }

    try {
      return await this.eventService.create(
        dto,
        userId,
        user.googleAccessToken,
      );
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
