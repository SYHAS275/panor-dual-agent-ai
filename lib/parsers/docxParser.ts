import mammoth from 'mammoth';
import logger from '../logger';

export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    logger.info('Parsing DOCX from buffer');

    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (!text) {
      throw new Error('No text content found in DOCX');
    }

    if (result.messages.length > 0) {
      logger.warn('DOCX parsing warnings:', result.messages);
    }

    logger.info(`Successfully parsed DOCX: ${text.length} characters extracted`);
    return text;
  } catch (error) {
    logger.error('DOCX parsing error:', error);
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
