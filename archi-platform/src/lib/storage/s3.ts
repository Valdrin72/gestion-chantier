import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type { StorageDriver } from "./index";

const client =
  env.STORAGE_DRIVER === "s3"
    ? new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT || undefined,
        credentials:
          env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.S3_ACCESS_KEY_ID,
                secretAccessKey: env.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
      })
    : null;

function bucket() {
  if (!env.S3_BUCKET) throw new Error("S3_BUCKET is not configured");
  return env.S3_BUCKET;
}

export const s3Storage: StorageDriver = {
  async put(key, data, opts) {
    if (!client) throw new Error("S3 client not initialized");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: data,
        ContentType: opts.contentType,
      }),
    );
  },
  async get(key) {
    if (!client) throw new Error("S3 client not initialized");
    const out = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const stream = out.Body as ReadableStream<Uint8Array> | null;
    if (!stream) throw new Error("Empty body");
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  },
  async remove(key) {
    if (!client) throw new Error("S3 client not initialized");
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
  async signedUrl(key, opts) {
    if (!client) throw new Error("S3 client not initialized");
    const cmd = new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: opts?.download
        ? `attachment; filename="${opts.filename ?? "file"}"`
        : undefined,
    });
    return getSignedUrl(client, cmd, { expiresIn: opts?.expiresInSeconds ?? 600 });
  },
};
