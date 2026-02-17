import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

let s3: S3Client | null = null;

function getClient(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: config.s3.endpoint,
      region: "garage",
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      forcePathStyle: true,
    });
  }
  return s3;
}

export async function initBucket(): Promise<void> {
  if (!config.s3.endpoint) {
    console.warn("S3 not configured — file uploads disabled");
    return;
  }

  const client = getClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
  }
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
  size: number,
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: size,
    }),
  );
}

export async function getFileUrl(key: string): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }),
    { expiresIn: 3600 },
  );
}

export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }),
  );
}
