import formidable, { File } from 'formidable';
import { NextRequest } from 'next/server';
import { config } from './config';
import logger from './logger';
import path from 'path';
import { mkdir } from 'fs/promises';

export interface UploadedFile {
  filepath: string;
  originalFilename: string;
  mimetype: string;
  size: number;
}

export async function parseFormData(req: NextRequest): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
}> {
  try {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: config.maxFileSize,
      filter: function ({ name, originalFilename, mimetype }) {
        const ext = path.extname(originalFilename || '').toLowerCase();
        const isValid = config.allowedFileTypes.includes(ext);

        if (!isValid) {
          logger.warn(`Rejected file upload: ${originalFilename} (type: ${ext})`);
        }

        return isValid;
      },
    });

    // Convert NextRequest to Node.js IncomingMessage-like object
    const headers: { [key: string]: string } = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const formData = await req.formData();
    const nodeReqLike = {
      headers,
      method: req.method,
      body: formData,
    };

    return new Promise((resolve, reject) => {
      form.parse(nodeReqLike as any, (err, fields, files) => {
        if (err) {
          logger.error('Form parsing error:', err);
          reject(err);
          return;
        }
        resolve({ fields, files });
      });
    });
  } catch (error) {
    logger.error('File upload error:', error);
    throw error;
  }
}

export function validateFile(file: File): UploadedFile {
  const ext = path.extname(file.originalFilename || '').toLowerCase();

  if (!config.allowedFileTypes.includes(ext)) {
    throw new Error(`File type ${ext} is not allowed`);
  }

  if (file.size > config.maxFileSize) {
    throw new Error(`File size exceeds maximum allowed size of ${config.maxFileSize} bytes`);
  }

  return {
    filepath: file.filepath,
    originalFilename: file.originalFilename || 'unknown',
    mimetype: file.mimetype || 'application/octet-stream',
    size: file.size,
  };
}
