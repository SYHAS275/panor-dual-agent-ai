import { NextRequest } from 'next/server';
import { askGemini } from '@/lib/ai/geminiService';
import { askChatGPT } from '@/lib/ai/openaiService';
import { FileData } from '@/lib/ai/geminiService';
import { config } from '@/lib/config';
import logger from '@/lib/logger';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FACE_IDENTIFICATION_PROMPT = `Analyze this image and identify every person visible. For each person, provide:

1. **Name**: The person's full name if recognizable (celebrity, public figure, politician, athlete, etc.). If unknown, say "Unidentified".
2. **Confidence**: How confident you are in the identification (High / Medium / Low).
3. **Context**: Brief context about who they are (occupation, known for, etc.).

Format your response as a numbered list, one entry per person visible in the image. If no faces are recognizable, say so clearly.

Be precise. Only identify someone by name if you are genuinely confident. Do not guess.`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No image uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return new Response(JSON.stringify({ error: 'Only image files are supported' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    const fileData: FileData = { buffer, mimeType: mimeMap[ext] || 'image/jpeg' };

    const hasGemini = !!config.geminiApiKey;
    const hasOpenAI = !!config.openaiApiKey;

    if (!hasGemini && !hasOpenAI) {
      return new Response(JSON.stringify({ error: 'No AI API keys configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const geminiPromise = hasGemini
            ? askGemini(FACE_IDENTIFICATION_PROMPT, '[Image sent directly]', fileData)
                .then((r) => {
                  send('gemini', { text: r.text, model: r.model, timestamp: r.timestamp });
                  return r;
                })
                .catch((e) => {
                  logger.error('Gemini face ID error:', e);
                  const fb = { text: `Gemini error: ${e.message}`, model: 'Error', timestamp: new Date() };
                  send('gemini', fb);
                  return fb;
                })
            : Promise.resolve((() => {
                const fb = { text: 'Gemini not configured', model: 'N/A', timestamp: new Date() };
                send('gemini', fb);
                return fb;
              })());

          const chatgptPromise = hasOpenAI
            ? askChatGPT(FACE_IDENTIFICATION_PROMPT, '[Image sent directly]', fileData)
                .then((r) => {
                  send('chatgpt', { text: r.text, model: r.model, timestamp: r.timestamp });
                  return r;
                })
                .catch((e) => {
                  logger.error('ChatGPT face ID error:', e);
                  const fb = { text: `ChatGPT error: ${e.message}`, model: 'Error', timestamp: new Date() };
                  send('chatgpt', fb);
                  return fb;
                })
            : Promise.resolve((() => {
                const fb = { text: 'ChatGPT not configured', model: 'N/A', timestamp: new Date() };
                send('chatgpt', fb);
                return fb;
              })());

          await Promise.all([geminiPromise, chatgptPromise]);

          send('done', {});
          controller.close();
        } catch (error) {
          logger.error('Face ID stream error:', error);
          send('error', { message: error instanceof Error ? error.message : 'Unknown error' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('Face identification error:', error);
    return new Response(JSON.stringify({ error: 'Failed to identify faces' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
