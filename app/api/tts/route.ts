import { NextRequest } from 'next/server';
import { synthesizeSpeech, getAvailableProviders, TTSProvider } from '@/lib/ai/ttsService';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, provider, voice, speed } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Limit text length to prevent abuse
    const maxLength = 4096;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    logger.info(`TTS request: ${truncatedText.substring(0, 50)}... (provider: ${provider || 'auto'})`);

    const result = await synthesizeSpeech(truncatedText, {
      provider: provider as TTSProvider,
      voice,
      speed,
    });

    return new Response(new Uint8Array(result.audioBuffer), {
      headers: {
        'Content-Type': result.contentType,
        'X-TTS-Provider': result.provider,
      },
    });
  } catch (error) {
    logger.error('TTS error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'TTS failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Get available TTS providers
export async function GET() {
  const providers = getAvailableProviders();
  return new Response(JSON.stringify({ providers }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
