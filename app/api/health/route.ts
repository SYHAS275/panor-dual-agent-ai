import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      maxFileSize: config.maxFileSize,
      allowedFileTypes: config.allowedFileTypes,
      hasOpenAIKey: !!config.openaiApiKey,
      hasGeminiKey: !!config.geminiApiKey,
    },
  };

  return NextResponse.json(health);
}
