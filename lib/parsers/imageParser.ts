import Tesseract from 'tesseract.js';
import logger from '../logger';

export async function parseImage(filePath: string): Promise<string> {
  try {
    logger.info(`Parsing image with OCR: ${filePath}`);

    const result = await Tesseract.recognize(
      filePath,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    const text = result.data.text.trim();

    if (!text) {
      throw new Error('No text content found in image');
    }

    logger.info(`Successfully parsed image: ${text.length} characters extracted`);
    return text;
  } catch (error) {
    logger.error('Image OCR error:', error);
    throw new Error(`Failed to parse image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
