import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserService } from './user/user.service.js';
import { EventModule } from './event/event.module.js';
import { DriveModule } from './drive/drive.module.js';
import { UploadModule } from './upload/upload.module.js';
import jwtConfig from './config/jwt.config.js';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig],
      envFilePath: '.env',
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    EventModule,
    DriveModule,
    UploadModule,
  ],
})
export class AppModule {}
