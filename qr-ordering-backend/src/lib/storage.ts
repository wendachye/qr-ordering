import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/env';
import { UPLOADS_DIR, UPLOADS_ROUTE, ensureUploadsDir } from './uploads';

export interface StoredObject {
  url: string;
}

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
}

/** Local disk (dev default). Returns a relative URL served by the /uploads route. */
class LocalStorage implements Storage {
  async put(key: string, body: Buffer, _contentType: string): Promise<StoredObject> {
    ensureUploadsDir();
    await fs.promises.writeFile(path.join(UPLOADS_DIR, key), body);
    return { url: `${UPLOADS_ROUTE}/${key}` };
  }
}

/**
 * S3 / S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, …). The SDK
 * + client are loaded lazily so a local deployment never pays for them.
 * Returns an absolute, publicly-resolvable URL.
 */
class S3Storage implements Storage {
  private clientPromise?: Promise<import('@aws-sdk/client-s3').S3Client>;

  private client() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await import('@aws-sdk/client-s3');
        return new S3Client({
          region: config.storage.region,
          endpoint: config.storage.endpoint,
          // Path-style addressing for non-AWS endpoints (R2/MinIO).
          forcePathStyle: !!config.storage.endpoint,
          credentials: {
            accessKeyId: config.storage.accessKeyId!,
            secretAccessKey: config.storage.secretAccessKey!,
          },
        });
      })();
    }
    return this.clientPromise;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const base = config.storage.publicUrl
      ? config.storage.publicUrl.replace(/\/$/, '')
      : config.storage.endpoint
        ? `${config.storage.endpoint.replace(/\/$/, '')}/${config.storage.bucket}`
        : `https://${config.storage.bucket}.s3.${config.storage.region}.amazonaws.com`;
    return { url: `${base}/${key}` };
  }
}

export const storage: Storage =
  config.storage.driver === 's3' ? new S3Storage() : new LocalStorage();
