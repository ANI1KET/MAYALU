import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { getConfig } from '../../config/app.config';

export interface PresignResult {
  uploadUrl: string;
  publicId: string;
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export interface UploadResult {
  url: string;
  publicId: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
  format?: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly folder: string;

  constructor() {
    const config = getConfig();
    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
    });
    this.folder = config.CLOUDINARY_FOLDER;
  }

  generatePresignedUpload(subfolder: string, filename: string): PresignResult {
    const config = getConfig();
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `${this.folder}/${subfolder}`;
    const publicId = `${folder}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, public_id: publicId },
      config.CLOUDINARY_API_SECRET,
    );

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`,
      publicId,
      signature,
      timestamp,
      apiKey: config.CLOUDINARY_API_KEY,
      cloudName: config.CLOUDINARY_CLOUD_NAME,
      folder,
    };
  }

  async deleteMedia(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to delete Cloudinary asset ${publicId}: ${msg}`);
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    subfolder: string,
    filename: string,
  ): Promise<UploadResult> {
    const folder = `${this.folder}/${subfolder}`;

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, public_id: `${Date.now()}-${filename}`, resource_type: 'auto' },
        (err, result) => {
          if (err || !result) {
            reject(err ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            fileSizeBytes: result.bytes,
            width: result.width,
            height: result.height,
            format: result.format,
          });
        },
      );
      stream.end(buffer);
    });
  }

  getStorageMbFromBytes(bytes: number): number {
    return bytes / (1024 * 1024);
  }
}
