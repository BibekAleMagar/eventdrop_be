import { Module } from '@nestjs/common';
import { EventService } from './event.service.js';
import { EventController } from './event.controller.js';
import { DriveModule } from '../drive/drive.module.js';

@Module({
  imports: [DriveModule],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
