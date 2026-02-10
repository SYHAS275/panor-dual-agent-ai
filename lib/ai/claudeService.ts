import Anthropic from '@anthropic-ai/sdk';
import { config, AI_MODELS } from '../config';
import logger from '../logger';
import { FileData } from './geminiService';

const anthropic = config.claudeApiKey
  ? new Anthropic({ apiKey: config.claudeApiKey })
  : null;

export interface ClaudeResponse {
  text: string;
  model: string;
  timestamp: Date;
}

export async function askClaude(
  question: string,
  extractedText: string,
  fileData?: FileData,
  conversationHistory?: { question: string; answer: string }[]
): Promise<ClaudeResponse> {
  try {
    if (!config.claudeApiKey || !anthropic) {
      throw new Error('Claude API key is not configured');
    }

    logger.info('Sending request to Claude API');

    // If we have an image, use Claude's vision capability
    if (fileData && fileData.mimeType.startsWith('image/')) {
      logger.info('Using Claude Vision for image analysis');

      const base64Data = fileData.buffer.toString('base64');
      const mediaType = fileData.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      const message = await anthropic.messages.create({
        model: AI_MODELS.CLAUDE,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: `${question}\n\nAnalyze the image and provide a comprehensive and accurate answer.`,
              },
            ],
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === 'text');
      const text = textBlock && 'text' in textBlock ? textBlock.text : '';

      if (!text) {
        throw new Error('Empty response from Claude Vision API');
      }

      logger.info('Successfully received vision response from Claude API');

      return {
        text,
        model: AI_MODELS.CLAUDE,
        timestamp: new Date(),
      };
    }

    // For PDFs, DOCX, TXT, or text-only — use extracted text
    const isTextOnly = question === extractedText;

    const prompt = isTextOnly
      ? `${question}\n\nPlease provide a comprehensive and accurate answer.`
      : `Based on the following document content, please answer this question: "${question}"\n\nDocument Content:\n${extractedText}\n\nPlease provide a comprehensive and accurate answer.`;

    // Build messages array with conversation history for follow-ups
    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const entry of conversationHistory) {
        messages.push({ role: 'user', content: entry.question });
        messages.push({ role: 'assistant', content: entry.answer });
      }
    }

    messages.push({ role: 'user', content: prompt });

    const message = await anthropic.messages.create({
      model: AI_MODELS.CLAUDE,
      max_tokens: 2000,
      system: isTextOnly
        ? 'You are a helpful AI assistant that provides comprehensive and accurate answers.'
        : 'You are a helpful AI assistant that analyzes documents and provides accurate answers based on the content provided.',
      messages,
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';

    if (!text) {
      throw new Error('Empty response from Claude API');
    }

    logger.info('Successfully received response from Claude API');

    return {
      text,
      model: AI_MODELS.CLAUDE,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Claude API error:', error);
    throw new Error(`Claude API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
