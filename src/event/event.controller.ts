import {
  Controller,
  Post,
  Body,
  UseGuards,
  InternalServerErrorException,
  UnauthorizedException,
  Get,
  NotFoundException,
  Query
} from '@nestjs/common';
import { EventService } from './event.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { Public } from '../common/decorator/public.decorator.js';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("my-events")
  async getMyEvents(@CurrentUser('id') userId: string) {
    return await this.eventService.getMyEvents(userId);
  }

  @Public()
  @Get()
  async getEventByCode(@Query('code') eventCode: string) {
    const event = await this.eventService.getEventByCode(eventCode);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  @Post()
  async create(@Body() dto: CreateEventDto, @CurrentUser('id') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { googleAccessToken: true, googleRefreshToken: true },
    });

    if (!user || !user.googleAccessToken || !user.googleRefreshToken) {
      throw new UnauthorizedException(
        'Google Drive access not found. Please log in with Google again.',
      );
    }

    try {
      return await this.eventService.create(
        dto,
        userId,
        user.googleAccessToken,
        user.googleRefreshToken,
      );
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
