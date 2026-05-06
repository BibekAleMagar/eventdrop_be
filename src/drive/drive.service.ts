import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { Readable } from 'stream';

@Injectable()
export class DriveService {
  private getDriveClient(accessToken: string, refreshToken?: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return google.drive({ version: 'v3', auth });
  }

  async createFolder(folderName: string, accessToken: string) {
    const drive = this.getDriveClient(accessToken);

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    try {
      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, webViewLink',
      });

      return {
        id: response.data.id,
        webViewLink: response.data.webViewLink,
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
    try {
      const drive = this.getDriveClient(accessToken, refreshToken);

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
        id: response.data.id,
        url: response.data.webViewLink,
      };
    } catch (err) {
      console.error('Google Drive Error:', err.response?.data || err.message);
      throw new InternalServerErrorException(
        `Google Upload Failed: ${err.message}`,
      );
    }
  }
}
