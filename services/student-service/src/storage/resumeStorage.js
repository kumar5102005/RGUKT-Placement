import fs from "node:fs";
import path from "node:path";

const provider = (process.env.RESUME_STORAGE_PROVIDER || "local").toLowerCase();
const uploadDirectory = path.resolve(process.env.RESUME_UPLOAD_DIR || "uploads/resumes");
const bucket = process.env.RESUME_S3_BUCKET;
const region = process.env.RESUME_S3_REGION || process.env.AWS_REGION;

let s3Client;
let s3Commands;

if (provider === "s3") {
  if (!bucket || !region) {
    throw new Error("RESUME_S3_BUCKET and RESUME_S3_REGION are required when RESUME_STORAGE_PROVIDER=s3.");
  }
  const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } =
    await import("@aws-sdk/client-s3");
  s3Client = new S3Client({ region });
  s3Commands = { PutObjectCommand, GetObjectCommand, HeadObjectCommand };
} else if (provider !== "local") {
  throw new Error(`Unsupported resume storage provider: ${provider}`);
}

function validateStorageKey(key) {
  if (
    typeof key !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key)
  ) {
    throw new Error("Invalid resume storage key.");
  }
  return key;
}

function getLocalPath(key) {
  const absolutePath = path.resolve(uploadDirectory, validateStorageKey(key));
  if (path.dirname(absolutePath) !== uploadDirectory) {
    throw new Error("Invalid resume storage key.");
  }
  return absolutePath;
}

function isMissingS3Object(error) {
  return error?.name === "NotFound" ||
    error?.name === "NoSuchKey" ||
    error?.$metadata?.httpStatusCode === 404;
}

export const resumeStorage = {
  async putObject({ key, body, contentType }) {
    validateStorageKey(key);
    if (!Buffer.isBuffer(body)) {
      throw new TypeError("Resume storage requires a Buffer body.");
    }

    if (provider === "s3") {
      await s3Client.send(new s3Commands.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        IfNoneMatch: "*",
      }));
      return;
    }

    await fs.promises.mkdir(uploadDirectory, { recursive: true });
    await fs.promises.writeFile(getLocalPath(key), body, { flag: "wx", mode: 0o600 });
  },

  async getObject(key) {
    validateStorageKey(key);
    if (provider === "s3") {
      const result = await s3Client.send(new s3Commands.GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      return result.Body;
    }
    return fs.createReadStream(getLocalPath(key));
  },

  async exists(key) {
    validateStorageKey(key);
    if (provider === "s3") {
      try {
        await s3Client.send(new s3Commands.HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }));
        return true;
      } catch (error) {
        if (isMissingS3Object(error)) return false;
        throw error;
      }
    }

    try {
      return (await fs.promises.stat(getLocalPath(key))).isFile();
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  },
};

export const resumeStorageProvider = provider;
