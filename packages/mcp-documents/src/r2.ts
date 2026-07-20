import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME!;
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME!;
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}

export async function deleteFromR2(key: string): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME!;
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const bucket = process.env.R2_BUCKET_NAME!;
  const { Body } = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}
