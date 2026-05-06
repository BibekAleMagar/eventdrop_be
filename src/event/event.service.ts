import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { DriveService } from '../drive/drive.service.js';
import { customAlphabet } from 'nanoid';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly driveService: DriveService,
  ) {}

  async create(dto: CreateEventDto, userId: string, googleToken: string) {
    try {
      const nanoid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
      const eventCode = nanoid();

      const folder = await this.driveService.createFolder(
        `Event_${dto.name}`,
        googleToken,
      );

      const event = await this.prisma.event.create({
        data: {
          name: dto.name,
          description: dto.description,
          date: dto.date,
          eventCode: eventCode,
          driveFolderId: folder.id || '',
          driveFolderUrl: folder.webViewLink || '',
          hostId: userId,
        },
      });

      return {
        name: event.name,
        url: event.driveFolderUrl,
        code: event.eventCode,
      };
    } catch (error) {
      throw error;
    }
  }
}
