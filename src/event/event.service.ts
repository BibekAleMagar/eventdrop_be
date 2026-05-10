import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { DriveService } from '../drive/drive.service.js';
import { customAlphabet } from 'nanoid';
import * as QRCode from 'qrcode';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly driveService: DriveService,
  ) {}

  async create(
    dto: CreateEventDto,
    userId: string,
    googleToken: string,
    refreshToken: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(dto.startingDate);
    const endDate = dto.endingDate ? new Date(dto.endingDate) : null;

    if (startDate <= today) {
      throw new BadRequestException('Starting date must be in the future');
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('Ending date must be after starting date');
    }

    const nanoid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
    const eventCode = nanoid();

    const folder = await this.driveService.createFolder(
      `Event_${dto.name}`,
      googleToken,
      refreshToken,
    );

    if (
      folder.id === undefined ||
      folder.id === null ||
      folder.webViewLink === undefined
    ) {
      throw new Error('Failed to create Google Drive folder');
    }

    const qrCodeUrl = await this.generateQr(
      eventCode,
      folder.id,
      googleToken,
      refreshToken,
    );

    const event = await this.prisma.event.create({
      data: {
        name: dto.name,
        description: dto.description,
        startingDate: dto.startingDate,
        eventCode: eventCode,
        driveFolderId: folder.id || '',
        driveFolderUrl: folder.webViewLink || '',
        hostId: userId,
        qrCodeUrl: qrCodeUrl,
      },
    });

    return {
      name: event.name,
      code: event.eventCode,
      driveUrl: event.driveFolderUrl,
      qrCodeUrl: event.qrCodeUrl,
    };
  }

  async getEvents(userId: string) {
    return await this.prisma.event.findMany({
      where: {
        hostId: userId,
      },
    });
  }

  private async generateQr(
    eventCode: string,
    folderId: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<string> {
    const qrContent = `${eventCode}`;

    const qrBuffer = await QRCode.toBuffer(qrContent, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 1,
    });

    const driveFile = await this.driveService.uploadFile(
      {
        buffer: qrBuffer,
        originalname: `QR_${eventCode}.png`,
        mimetype: 'image/png',
      } as Express.Multer.File,
      folderId,
      accessToken,
      refreshToken,
    );

    return driveFile.url;
  }
}
