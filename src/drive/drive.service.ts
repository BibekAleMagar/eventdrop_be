import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DriveService {
  constructor(private readonly prisma: PrismaService) {}

  private getAuthClient(accessToken: string, refreshToken: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    auth.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await this.prisma.user.updateMany({
          where: { googleRefreshToken: refreshToken },
          data: {
            googleAccessToken: tokens.access_token,
            ...(tokens.expiry_date && {
              googleTokenExpiry: new Date(tokens.expiry_date),
            }),
          },
        });
      }
    });

    return auth;
  }

  // 👇 Returns the refreshed access token alongside the folder data
  async createFolder(folderName: string, accessToken: string, refreshToken: string) {
    const auth = this.getAuthClient(accessToken, refreshToken);
    const drive = google.drive({ version: 'v3', auth });

    try {
      const response = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, webViewLink',
      });

      // 👇 Get the (possibly refreshed) access token from the auth client
      const credentials = await auth.getAccessToken();
      const newAccessToken = credentials.token ?? accessToken;

      return {
        id: response.data.id,
        webViewLink: response.data.webViewLink,
        newAccessToken, // 👈 return it so callers can use the fresh token
      };
    } catch (error) {
      throw new Error(`Failed to create Google Drive folder: ${error.message}`);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folderId: string,
    accessToken: string,
    refreshToken: string,
  ) {
    const auth = this.getAuthClient(accessToken, refreshToken);
    const drive = google.drive({ version: 'v3', auth });

    try {
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const response = await drive.files.create({
        requestBody: {
          name: file.originalname || `capture_${Date.now()}.jpg`,
          parents: [folderId],
        },
        media: {
          mimeType: file.mimetype,
          body: bufferStream,
        },
        fields: 'id, webViewLink',
      });

      return {
        id: response.data.id ?? '',
        url: response.data.webViewLink ?? '',
      };
    } catch (err) {
      console.error('Google Drive Error:', err.response?.data || err.message);
      throw new InternalServerErrorException(
        `Google Upload Failed: ${err.message}`,
      );
    }
  }
}