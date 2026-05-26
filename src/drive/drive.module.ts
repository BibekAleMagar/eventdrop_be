import { Module } from '@nestjs/common';
import { DriveService } from './drive.service.js';
import { DriveController } from './drive.controller.js';
@Module({
  providers: [DriveService],
  exports: [DriveService],
  controllers: [DriveController],
})
export class DriveModule {}
