import { config } from '../config';
import logger from '../logger';

export type TTSProvider = 'personaplex' | 'openai' | 'browser';

export interface TTSOptions {
  provider?: TTSProvider;
  voice?: string;
  speed?: number;
}

export interface TTSResponse {
  audioBuffer: Buffer;
  provider: TTSProvider;
  contentType: string;
}

// NVIDIA PersonaPlex TTS
async function synthesizeWithPersonaplex(text: string, voice?: string): Promise<TTSResponse> {
  const serverUrl = config.personaplexServerUrl;
  if (!serverUrl) {
    throw new Error('PersonaPlex server URL not configured');
  }

  logger.info('Synthesizing speech with NVIDIA PersonaPlex');

  // PersonaPlex offline inference API
  const response = await fetch(`${serverUrl}/api/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_prompt: voice || 'default',
    }),
  });

  if (!response.ok) {
    throw new Error(`PersonaPlex API error: ${response.status}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return {
    audioBuffer,
    provider: 'personaplex',
    contentType: 'audio/wav',
  };
}

// OpenAI TTS
async function synthesizeWithOpenAI(text: string, voice?: string, speed?: number): Promise<TTSResponse> {
  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  logger.info('Synthesizing speech with OpenAI TTS');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: voice || 'alloy', // alloy, echo, fable, onyx, nova, shimmer
      speed: speed || 1.0,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${error}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return {
    audioBuffer,
    provider: 'openai',
    contentType: 'audio/mpeg',
  };
}

// Main synthesis function with fallback
export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResponse> {
  const { provider, voice, speed } = options;

  // If specific provider requested, use only that
  if (provider === 'personaplex') {
    return synthesizeWithPersonaplex(text, voice);
  }

  if (provider === 'openai') {
    return synthesizeWithOpenAI(text, voice, speed);
  }

  if (provider === 'browser') {
    // Browser TTS is handled client-side
    throw new Error('Browser TTS should be handled on the client');
  }

  // Auto-detect best available provider
  // Priority: PersonaPlex > OpenAI > Browser (client-side)

  if (config.personaplexServerUrl) {
    try {
      return await synthesizeWithPersonaplex(text, voice);
    } catch (error) {
      logger.warn('PersonaPlex failed, falling back to OpenAI:', error);
    }
  }

  if (config.openaiApiKey) {
    try {
      return await synthesizeWithOpenAI(text, voice, speed);
    } catch (error) {
      logger.warn('OpenAI TTS failed:', error);
      throw error;
    }
  }

  throw new Error('No TTS provider available. Configure PERSONAPLEX_SERVER_URL or OPENAI_API_KEY');
}

// Get available TTS providers
export function getAvailableProviders(): TTSProvider[] {
  const providers: TTSProvider[] = ['browser']; // Browser is always available

  if (config.openaiApiKey) {
    providers.unshift('openai');
  }

  if (config.personaplexServerUrl) {
    providers.unshift('personaplex');
  }

  return providers;
}

// Voice options for each provider
export const VOICE_OPTIONS = {
  personaplex: [
    { id: 'default', name: 'Default Voice' },
    { id: 'NATF2', name: 'Natural Female' },
    { id: 'NATM1', name: 'Natural Male' },
  ],
  openai: [
    { id: 'alloy', name: 'Alloy (Neutral)' },
    { id: 'echo', name: 'Echo (Male)' },
    { id: 'fable', name: 'Fable (British)' },
    { id: 'onyx', name: 'Onyx (Deep Male)' },
    { id: 'nova', name: 'Nova (Female)' },
    { id: 'shimmer', name: 'Shimmer (Soft Female)' },
  ],
  browser: [
    { id: 'default', name: 'System Default' },
  ],
};
