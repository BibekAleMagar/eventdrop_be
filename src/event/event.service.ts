import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
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

    if (startDate < today) {
      throw new BadRequestException('Starting date must be in the future');
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('Ending date must be after starting date');
    }

    const nanoid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
    const eventCode = nanoid();

    let folder: {
      id: string | null | undefined;
      webViewLink: string | null | undefined;
      newAccessToken: string; // 👈 typed here
    };

    try {
      folder = await this.driveService.createFolder(
        `Event_${dto.name}`,
        googleToken,
        refreshToken,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to create Google Drive folder',
        error.message,
      );
    }

    if (!folder.id || !folder.webViewLink) {
      throw new InternalServerErrorException(
        'Google Drive folder creation returned incomplete data',
      );
    }

    // 👇 Use the refreshed token for all subsequent Drive calls
    const validToken = folder.newAccessToken ?? googleToken;

    let qrCodeUrl: string;

    try {
      qrCodeUrl = await this.generateQr(
        eventCode,
        folder.id,
        validToken, // 👈 fresh token
        refreshToken,
      );
    } catch (error) {
      console.error('QR generation error:', error);
      throw new InternalServerErrorException(
        'Failed to generate QR code',
        error.message,
      );
    }

    let event: Awaited<ReturnType<typeof this.prisma.event.create>>;

    try {
      event = await this.prisma.event.create({
        data: {
          name: dto.name,
          description: dto.description,
          startingDate: dto.startingDate,
          endingDate: dto.endingDate,
          eventCode: eventCode,
          driveFolderId: folder.id,
          driveFolderUrl: folder.webViewLink,
          hostId: userId,
          qrCodeUrl: qrCodeUrl,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to save event to the database',
        error.message,
      );
    }

    return {
      name: event.name,
      code: event.eventCode,
      driveUrl: event.driveFolderUrl,
      qrCodeUrl: event.qrCodeUrl,
    };
  }

  async getMyEvents(userId: string) {
    return await this.prisma.event.findMany({
      where: {
        hostId: userId,
      },
    });
  }

  async getEventByCode(eventCode: string) {
    return await this.prisma.event.findUnique({
      where: {
        eventCode: eventCode,
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