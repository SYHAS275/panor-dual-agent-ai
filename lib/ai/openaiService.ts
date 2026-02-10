import OpenAI from 'openai';
import { config, AI_MODELS } from '../config';

import logger from '../logger';
import { FileData } from './geminiService';

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

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
      msg.includes('too many requests') ||
      msg.includes('503') ||
      msg.includes('service unavailable') ||
      msg.includes('500') ||
      msg.includes('internal') ||
      msg.includes('overloaded') ||
      msg.includes('capacity')
    );
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status === 500 || status === 503;
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

export interface OpenAIResponse {
  text: string;
  model: string;
  timestamp: Date;
}

export async function askChatGPT(
  question: string,
  extractedText: string,
  fileData?: FileData,
  conversationHistory?: { question: string; answer: string }[]
): Promise<OpenAIResponse> {
  try {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Sending request to OpenAI API');

    // If we have an image, use GPT-4 Vision
    if (fileData && fileData.mimeType.startsWith('image/')) {
      logger.info('Using GPT-4 Vision for image analysis');

      const base64Url = `data:${fileData.mimeType};base64,${fileData.buffer.toString('base64')}`;

      return await withRetry(async () => {
        const completion = await openai.chat.completions.create({
          model: AI_MODELS.OPENAI,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant that analyzes images and provides accurate, comprehensive answers.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${question}\n\nAnalyze the image and provide a comprehensive and accurate answer.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: base64Url, detail: 'high' },
                },
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });

        const text = completion.choices[0]?.message?.content;

        if (!text) {
          throw new Error('Empty response from OpenAI Vision API');
        }

        logger.info('Successfully received vision response from OpenAI API');

        return {
          text,
          model: AI_MODELS.OPENAI,
          timestamp: new Date(),
        };
      }, 'OpenAI Vision');
    }

    // For PDFs, DOCX, TXT, or text-only — use extracted text
    const isTextOnly = question === extractedText;

    const prompt = isTextOnly
      ? `${question}\n\nPlease provide a comprehensive and accurate answer.`
      : `Based on the following document content, please answer this question: "${question}"\n\nDocument Content:\n${extractedText}\n\nPlease provide a comprehensive and accurate answer.`;

    // Build messages array with conversation history for follow-ups
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: isTextOnly
          ? 'You are a helpful AI assistant that provides comprehensive and accurate answers.'
          : 'You are a helpful AI assistant that analyzes documents and provides accurate answers based on the content provided.',
      },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const entry of conversationHistory) {
        messages.push({ role: 'user', content: entry.question });
        messages.push({ role: 'assistant', content: entry.answer });
      }
    }

    messages.push({ role: 'user', content: prompt });

    return await withRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: AI_MODELS.OPENAI,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const text = completion.choices[0]?.message?.content;

      if (!text) {
        throw new Error('Empty response from OpenAI API');
      }

      logger.info('Successfully received response from OpenAI API');

      return {
        text,
        model: AI_MODELS.OPENAI,
        timestamp: new Date(),
      };
    }, 'OpenAI text');
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error(`OpenAI API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function summarizeResponses(
  geminiResponse: string,
  chatgptResponse: string
): Promise<OpenAIResponse> {
  try {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Generating final summarized response');

    const prompt = `You are an expert AI judge. Combine the following two answers into a single high-quality response. Remove duplication, fix mistakes, improve clarity, and produce the best possible final answer.

Gemini's Response:
${geminiResponse}

ChatGPT's Response:
${chatgptResponse}

Provide a comprehensive, accurate, and well-structured final answer that takes the best from both responses.`;

    return await withRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: AI_MODELS.OPENAI_FAST,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI judge tasked with combining multiple AI responses into a single, superior answer.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 2500,
      });

      const text = completion.choices[0]?.message?.content;

      if (!text) {
        throw new Error('Empty response from summarization');
      }

      logger.info('Successfully generated final summary');

      return {
        text,
        model: `${AI_MODELS.OPENAI} (Summarizer)`,
        timestamp: new Date(),
      };
    }, 'OpenAI summarize');
  } catch (error) {
    logger.error('Summarization error:', error);
    throw new Error(`Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
