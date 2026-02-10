import { parsePDF } from './pdfParser';
import { parseDOCX } from './docxParser';
import { parseText } from './textParser';
import logger from '../logger';

export async function extractTextFromBuffer(buffer: Buffer, extension: string): Promise<string> {
  try {
    const ext = extension.toLowerCase();

    logger.info(`Extracting text from file type: ${ext}`);

    switch (ext) {
      case '.pdf':
        return await parsePDF(buffer);

      case '.docx':
        return await parseDOCX(buffer);

      case '.txt':
        return await parseText(buffer);

      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    logger.error('Text extraction error:', error);
    throw error;
  }
}
