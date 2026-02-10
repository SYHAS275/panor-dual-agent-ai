import logger from '../logger';

export async function parseText(buffer: Buffer): Promise<string> {
  try {
    logger.info('Reading text from buffer');

    const text = buffer.toString('utf-8').trim();

    if (!text) {
      throw new Error('No text content found in file');
    }

    logger.info(`Successfully read text: ${text.length} characters`);
    return text;
  } catch (error) {
    logger.error('Text reading error:', error);
    throw new Error(`Failed to read text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
