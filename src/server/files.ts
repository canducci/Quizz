import {
  CreateBucketCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { v7 as uuidv7, validate } from "uuid";
import { imageType, MAX_IMAGE_BYTES } from "./image-type";

const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

export async function ensureBucket() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (e) {
    const exists = ["BucketAlreadyOwnedByYou", "BucketAlreadyExists"];
    if (!(e instanceof S3ServiceException && exists.includes(e.name))) throw e;
  }
}

export type UploadResult = { key: string } | { error: "badImage" | "tooLarge" };

/** Stores a PNG or JPEG under a fresh key; nothing is ever overwritten. */
export async function putImage(file: File): Promise<UploadResult> {
  if (file.size > MAX_IMAGE_BYTES) return { error: "tooLarge" };
  const body = new Uint8Array(await file.arrayBuffer());
  const type = imageType(body);
  if (!type) return { error: "badImage" };
  const key = uuidv7();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: type }));
  return { key };
}

/** The stored file, or null when the key isn't one of ours or doesn't exist. */
export async function getFile(key: string) {
  if (!validate(key)) return null;
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return {
      body: object.Body!.transformToWebStream(),
      type: object.ContentType ?? "application/octet-stream",
    };
  } catch (e) {
    if (e instanceof NoSuchKey) return null;
    throw e;
  }
}
