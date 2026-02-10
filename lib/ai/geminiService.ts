import { GoogleGenerativeAI } from '@google/generative-ai';
import { config, AI_MODELS } from '../config';
import logger from '../logger';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('quota') ||
      msg.includes('resource exhausted') ||
      msg.includes('too many requests') ||
      msg.includes('503') ||
      msg.includes('service unavailable') ||
      msg.includes('500') ||
      msg.includes('internal') ||
      msg.includes('overloaded') ||
      msg.includes('capacity')
    );
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
        logger.warn(`${label} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

export interface GeminiResponse {
  text: string;
  model: string;
  timestamp: Date;
}

export interface FileData {
  buffer: Buffer;
  mimeType: string;
}

export async function askGemini(
  question: string,
  extractedText: string,
  fileData?: FileData,
  conversationHistory?: { question: string; answer: string }[]
): Promise<GeminiResponse> {
  try {
    if (!config.geminiApiKey) {
      throw new Error('Gemini API key is not configured');
    }

    logger.info('Sending request to Gemini API');

    const model = genAI.getGenerativeModel({ model: AI_MODELS.GEMINI });

    // If we have file data (image or PDF), use Gemini's native multimodal API
    if (fileData) {
      const isImage = fileData.mimeType.startsWith('image/');
      const isPDF = fileData.mimeType === 'application/pdf';

      if (isImage || isPDF) {
        logger.info(`Using Gemini multimodal for ${isImage ? 'image' : 'PDF'} analysis`);

        const filePart = {
          inlineData: {
            data: fileData.buffer.toString('base64'),
            mimeType: fileData.mimeType,
          },
        };

        const prompt = isImage
          ? `${question}\n\nAnalyze the image and provide a comprehensive and accurate answer.`
          : `${question}\n\nAnalyze the PDF document and provide a comprehensive and accurate answer.`;

        return await withRetry(async () => {
          const result = await model.generateContent([prompt, filePart]);
          const response = await result.response;
          const text = response.text();

          if (!text) {
            throw new Error('Empty response from Gemini API');
          }

          logger.info(`Successfully received multimodal response from Gemini API`);

          return {
            text,
            model: AI_MODELS.GEMINI,
            timestamp: new Date(),
          };
        }, 'Gemini multimodal');
      }
    }

    // Text-only or document text mode (DOCX, TXT, or fallback)
    const isTextOnly = question === extractedText;

    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = 'Previous conversation:\n' +
        conversationHistory.map((h) => `User: ${h.question}\nAssistant: ${h.answer}`).join('\n\n') +
        '\n\n';
    }

    const prompt = isTextOnly
      ? `${historyContext}${question}\n\nPlease provide a comprehensive and accurate answer.`
      : `${historyContext}Based on the following document content, please answer this question: "${question}"\n\nDocument Content:\n${extractedText}\n\nPlease provide a comprehensive and accurate answer.`;

    return await withRetry(async () => {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      logger.info('Successfully received response from Gemini API');

      return {
        text,
        model: AI_MODELS.GEMINI,
        timestamp: new Date(),
      };
    }, 'Gemini text');
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new Error(`Gemini API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
