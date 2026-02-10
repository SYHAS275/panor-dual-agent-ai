export const config = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  allowedFileTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.txt'],
  apiTimeout: parseInt(process.env.API_TIMEOUT || '60000'), // 60 seconds
  rateLimit: parseInt(process.env.RATE_LIMIT || '10'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  personaplexServerUrl: process.env.PERSONAPLEX_SERVER_URL || '',
};

export const AI_MODELS = {
  OPENAI: 'gpt-4o',
  OPENAI_FAST: 'gpt-4o-mini',
  GEMINI: 'gemini-2.0-flash',
  CLAUDE: 'claude-sonnet-4-20250514',
};

export const SUMMARIZATION_PROMPT = `You are an expert AI judge. Combine the following two answers into a single high-quality response. Remove duplication, fix mistakes, improve clarity, and produce the best possible final answer.

Gemini's Response:
{gemini_response}

ChatGPT's Response:
{chatgpt_response}

Provide a comprehensive, accurate, and well-structured final answer that takes the best from both responses.`;
