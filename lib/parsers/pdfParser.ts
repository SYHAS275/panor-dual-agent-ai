import pdf from 'pdf-parse';
import logger from '../logger';

export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    logger.info('Parsing PDF from buffer');
    const data = await pdf(buffer);

    const text = data.text.trim();

    if (!text) {
      throw new Error('No text content found in PDF');
    }

    logger.info(`Successfully parsed PDF: ${text.length} characters extracted`);
    return text;
  } catch (error) {
    logger.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
