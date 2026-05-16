// src/users/users.service.ts

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email is already registered');

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash,
      },
    });

    return this.sanitize(user);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async upsertGoogleUser(data: {
    googleId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    googleAccessToken: string;
    googleRefreshToken?: string;
    googleTokenExpiry?: Date;
  }) {
    // 💡 1. Look up if the user already exists to protect an existing refresh token
    const existingUser = await this.prisma.user.findUnique({
      where: { googleId: data.googleId },
    });

    // 💡 2. Fall back to the token already in the DB if Google omitted it this time
    const resolvedRefreshToken = data.googleRefreshToken ?? existingUser?.googleRefreshToken;

    return this.prisma.user.upsert({
      where: { googleId: data.googleId },
      update: {
        googleAccessToken: data.googleAccessToken,
        googleRefreshToken: resolvedRefreshToken, // 🔑 Ensured it won't be dropped
        ...(data.googleTokenExpiry && { googleTokenExpiry: data.googleTokenExpiry }),
        avatarUrl: data.avatarUrl,
        displayName: data.displayName,
      },
      create: {
        googleId: data.googleId,
        email: data.email,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        googleAccessToken: data.googleAccessToken,
        googleRefreshToken: data.googleRefreshToken, // Saved during initial setup
        googleTokenExpiry: data.googleTokenExpiry,
      },
    });
  }

  async updateTokens(
    userId: string,
    tokens: {
      googleAccessToken: string;
      googleRefreshToken?: string;
      googleTokenExpiry?: Date;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: tokens,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return this.sanitize(user);
  }

  private sanitize(user: any) {
    const { passwordHash, googleAccessToken, googleRefreshToken, ...safe } =
      user;
    return safe;
  }
}