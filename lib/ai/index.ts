import { askGemini, GeminiResponse, FileData } from './geminiService';
import { askChatGPT, summarizeResponses, OpenAIResponse } from './openaiService';
import { askClaude, ClaudeResponse } from './claudeService';
import { config } from '../config';
import logger from '../logger';

export interface AIAnalysisResult {
  gemini: GeminiResponse;
  chatgpt: OpenAIResponse;
  claude: ClaudeResponse;
  summary: OpenAIResponse;
}

export async function analyzeDocument(
  question: string,
  extractedText: string,
  fileData?: FileData
): Promise<AIAnalysisResult> {
  try {
    logger.info('Starting AI analysis');

    const hasOpenAI = !!config.openaiApiKey;
    const hasGemini = !!config.geminiApiKey;
    const hasClaude = !!config.claudeApiKey;

    if (!hasGemini && !hasOpenAI && !hasClaude) {
      throw new Error('No AI API keys configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or CLAUDE_API_KEY in .env.local');
    }

    // Run whichever services are available, passing file data if present
    const geminiPromise = hasGemini
      ? askGemini(question, extractedText, fileData)
      : null;

    const chatgptPromise = hasOpenAI
      ? askChatGPT(question, extractedText, fileData)
      : null;

    const claudePromise = hasClaude
      ? askClaude(question, extractedText, fileData)
      : null;

    const [geminiResult, chatgptResult, claudeResult] = await Promise.all([
      geminiPromise,
      chatgptPromise,
      claudePromise,
    ]);

    const geminiResponse: GeminiResponse = geminiResult || {
      text: 'Gemini API key not configured. Add GEMINI_API_KEY to .env.local to enable.',
      model: 'Not configured',
      timestamp: new Date(),
    };

    const chatgptResponse: OpenAIResponse = chatgptResult || {
      text: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local to enable.',
      model: 'Not configured',
      timestamp: new Date(),
    };

    const claudeResponse: ClaudeResponse = claudeResult || {
      text: 'Claude API key not configured. Add CLAUDE_API_KEY to .env.local to enable.',
      model: 'Not configured',
      timestamp: new Date(),
    };

    logger.info('Available AI services responded successfully');

    // Generate summary: use OpenAI if available, otherwise use best available response
    let summary: OpenAIResponse;

    const validResponses = [geminiResult, chatgptResult, claudeResult].filter(Boolean);

    if (hasOpenAI && validResponses.length >= 2) {
      const textsToSummarize = validResponses.map((r) => r!.text);
      summary = await summarizeResponses(textsToSummarize[0], textsToSummarize[1]);
    } else if (claudeResult) {
      summary = {
        text: claudeResponse.text,
        model: `${claudeResponse.model} (Single source)`,
        timestamp: new Date(),
      };
    } else if (geminiResult) {
      summary = {
        text: geminiResponse.text,
        model: `${geminiResponse.model} (Single source)`,
        timestamp: new Date(),
      };
    } else {
      summary = {
        text: chatgptResponse.text,
        model: `${chatgptResponse.model} (Single source)`,
        timestamp: new Date(),
      };
    }

    logger.info('AI analysis completed successfully');

    return {
      gemini: geminiResponse,
      chatgpt: chatgptResponse,
      claude: claudeResponse,
      summary,
    };
  } catch (error) {
    logger.error('AI analysis error:', error);
    throw error;
  }
}

export { askGemini, askChatGPT, askClaude, summarizeResponses };
export type { FileData, ClaudeResponse };
