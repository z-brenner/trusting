import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { env } from "../env";
import type { StorageDriver } from "./index";

/** S3-compatible driver (AWS S3, MinIO, Cloudflare R2, Backblaze B2, ...). */
export class S3Storage implements StorageDriver {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const e = env();
    this.bucket = e.S3_BUCKET!;
    this.client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
    });
  }

  async put(key: string, body: Buffer | Readable, contentType: string, size?: number): Promise<void> {
    const payload = Buffer.isBuffer(body) ? body : await streamToBuffer(body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: payload,
        ContentType: contentType,
        ContentLength: size ?? payload.length,
      }),
    );
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      const stream = res.Body as unknown as { transformToWebStream?: () => ReadableStream };
      const nodeStream =
        res.Body instanceof Readable
          ? res.Body
          : Readable.fromWeb(stream.transformToWebStream!() as import("node:stream/web").ReadableStream);
      return { stream: nodeStream, contentType: res.ContentType, size: res.ContentLength };
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
