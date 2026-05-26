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

  async getStorageQuota(accessToken: string, refreshToken: string) {
  const auth = this.getAuthClient(accessToken, refreshToken);
  const drive = google.drive({ version: 'v3', auth });

  const about = await drive.about.get({
    fields: 'storageQuota, user',
  });

  const quota = about.data.storageQuota;
  const user = about.data.user;

  const used = Number(quota?.usage ?? 0);
  const total = Number(quota?.limit ?? 0);
  const usedInDrive = Number(quota?.usageInDrive ?? 0);
  const usedInTrash = Number(quota?.usageInDriveTrash ?? 0);

  return {
    user: {
      name: user?.displayName,
      email: user?.emailAddress,
      photoUrl: user?.photoLink,
    },
    storage: {
      totalBytes: total,
      usedBytes: used,
      usedInDriveBytes: usedInDrive,
      usedInTrashBytes: usedInTrash,
      freeBytes: total > 0 ? total - used : null,
      usedPercent: total > 0 ? Math.round((used / total) * 100) : null,
      total: this.formatBytes(total),
      used: this.formatBytes(used),
      usedInDrive: this.formatBytes(usedInDrive),
      usedInTrash: this.formatBytes(usedInTrash),
      free: total > 0 ? this.formatBytes(total - used) : 'Unlimited',
    },
  };
}

async getRecentFiles(accessToken: string, refreshToken: string, limit = 10) {
  const auth = this.getAuthClient(accessToken, refreshToken);
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    pageSize: limit,
    orderBy: 'modifiedTime desc',
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)',
    q: 'trashed=false',
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    sizeBytes: Number(f.size ?? 0),
    size: this.formatBytes(Number(f.size ?? 0)),
    modifiedAt: f.modifiedTime,
    webViewLink: f.webViewLink,
    iconLink: f.iconLink,
  }));
}

// async getSettingsSummary(accessToken: string, refreshToken: string) {
//   const [quota, recentFiles] = await Promise.all([
//     this.getStorageQuota(accessToken, refreshToken),
//     this.getRecentFiles(accessToken, refreshToken),
//   ]);

//   return { quota, recentFiles };
// }

private formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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