import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async create (dto: CreateEventDto, userId:string, googleToken: string) {
    

  }
 
}
