import multer from "multer";
import path from "node:path";

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".pdf", ".doc", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();

  const allowedMimeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.ms-word",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ]);

  const isAllowedMime = Boolean(file.mimetype) && (
    allowedMimeTypes.has(file.mimetype) ||
    (file.mimetype.startsWith("application/") && ext === ".pdf")
  );

  if (allowedExtensions.includes(ext) && isAllowedMime) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF, DOC, and DOCX files are allowed."), false);
  }
};

export const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_SIZE_BYTES,
  },
  fileFilter,
});

export const MAX_RESUME_SIZE_BYTES_VALUE = MAX_RESUME_SIZE_BYTES;
