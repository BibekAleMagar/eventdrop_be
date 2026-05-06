import { Module } from '@nestjs/common';
import { UploadService } from './upload.service.js';
import { UploadController } from './upload.controller.js';
import { DriveModule } from '../drive/drive.module.js';

@Module({
  imports: [DriveModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
