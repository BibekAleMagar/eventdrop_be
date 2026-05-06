import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service.js';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  async handleGuestUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('eventCode') eventCode: string,
  ) {
    if (!file) {
      throw new BadRequestException('No photo uploaded');
    }
    if (!eventCode) {
      throw new BadRequestException('Event code is required');
    }

    return await this.uploadService.uploadFromGuest(file, eventCode);
  }
}
