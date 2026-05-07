import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriveService } from '../drive/drive.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import sharp from 'sharp';

@Injectable()
export class UploadService {
  constructor(
    private readonly driveService: DriveService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadFromGuest(file: Express.Multer.File, eventCode: string) {
    const event = await this.prisma.event.findUnique({
      where: {
        eventCode: eventCode,
      },
      include: {
        host: true,
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    if (event.endingDate) {
      const today = new Date();
      const endDate = new Date(event.endingDate);

      if (today > endDate) {
        throw new BadRequestException(
          'Event has already ended, uploads are no longer allowed',
        );
      }
    }

    if (!event.host.googleAccessToken || !event.host.googleRefreshToken) {
      throw new NotFoundException('Host google credentials not found');
    }

    const compressBuffer = await sharp(file.buffer)
      .resize(1600, 1200, { fit: 'inside' }) // Fast mobile size
      .jpeg({ quality: 75 })
      .toBuffer();

    const driveFile = await this.driveService.uploadFile(
      {
        ...file,
        buffer: compressBuffer,
      },
      event.driveFolderId,
      event.host.googleAccessToken,
      event.host.googleRefreshToken,
    );

    return {
      url: driveFile.url,
    };
  }
}
