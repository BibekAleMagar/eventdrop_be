import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';

@Injectable()
export class DriveService {
  private getDriveClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    return google.drive({ version: 'v3', auth: oauth2Client });
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
}