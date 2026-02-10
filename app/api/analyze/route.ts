import { NextRequest } from 'next/server';
import { extractTextFromBuffer } from '@/lib/parsers';
import { askGemini } from '@/lib/ai/geminiService';
import { askChatGPT, summarizeResponses } from '@/lib/ai/openaiService';
import { FileData } from '@/lib/ai/geminiService';
import { config } from '@/lib/config';
import logger from '@/lib/logger';
import path from 'path';
import { cleanText } from '@/lib/utils/textCleaner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const PDF_EXTENSIONS = ['.pdf'];
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.txt', '.webp', '.gif'];

function getFileCategory(ext: string): 'image' | 'pdf' | 'document' {
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
  return 'document';
}

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function POST(req: NextRequest) {
  try {
    logger.info('Received analyze request');

    // Use native FormData — no formidable, no disk I/O
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const question = formData.get('question') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!question || question.trim().length < 1) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ext = path.extname(file.name).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return new Response(JSON.stringify({ error: `File type ${ext} is not supported` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.size > config.maxFileSize) {
      return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info(`Processing file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    // Read file into memory buffer — no disk writes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const category = getFileCategory(ext);
    let extractedText = '';
    let fileData: FileData | undefined;

    if (category === 'image') {
      // Images: send raw buffer to vision APIs — no OCR, no disk
      logger.info('Image — sending directly to vision APIs');
      fileData = { buffer, mimeType: getMimeType(ext) };
      extractedText = '[Image provided directly to vision APIs]';

    } else if (category === 'pdf') {
      // PDFs: buffer for Gemini native + extract text for OpenAI
      logger.info('PDF — native buffer for Gemini + text extraction for OpenAI');
      fileData = { buffer, mimeType: 'application/pdf' };

      try {
        extractedText = await extractTextFromBuffer(buffer, ext);
      } catch {
        extractedText = '[PDF text extraction failed — using native PDF analysis]';
      }

      const MAX_TEXT_LENGTH = 8000;
      if (extractedText.length > MAX_TEXT_LENGTH) {
        extractedText = extractedText.substring(0, MAX_TEXT_LENGTH) +
          '\n\n[Text truncated for performance]';
      }

    } else {
      // DOCX, TXT: extract text from buffer
      logger.info('Document — extracting text from buffer');
      extractedText = await extractTextFromBuffer(buffer, ext);

      if (!extractedText || extractedText.length < 10) {
        return new Response(JSON.stringify({ error: 'Could not extract text from file' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const MAX_TEXT_LENGTH = 8000;
      if (extractedText.length > MAX_TEXT_LENGTH) {
        extractedText = extractedText.substring(0, MAX_TEXT_LENGTH) +
          '\n\n[Text truncated for performance]';
      }
    }

    const hasGemini = !!config.geminiApiKey;
    const hasOpenAI = !!config.openaiApiKey;

    if (!hasGemini && !hasOpenAI) {
      return new Response(JSON.stringify({ error: 'No AI API keys configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fileInfo = { name: file.name, size: file.size, type: file.type };
    const encoder = new TextEncoder();
    const capturedText = extractedText;
    const capturedFileData = fileData;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send('file', fileInfo);

          const geminiPromise = hasGemini
            ? askGemini(question, capturedText, capturedFileData)
                .then((r) => {
                  const cleaned = cleanText(r.text);
                  send('gemini', { text: cleaned, model: r.model, timestamp: r.timestamp });
                  return { ...r, text: cleaned };
                })
                .catch((e) => {
                  logger.error('Gemini stream error:', e);
                  const fallback = { text: `Gemini error: ${e.message}`, model: 'Error', timestamp: new Date() };
                  send('gemini', fallback);
                  return fallback;
                })
            : Promise.resolve(
                (() => {
                  const fb = { text: 'Gemini not configured', model: 'Not configured', timestamp: new Date() };
                  send('gemini', fb);
                  return fb;
                })()
              );

          const chatgptPromise = hasOpenAI
            ? askChatGPT(question, capturedText, capturedFileData)
                .then((r) => {
                  const cleaned = cleanText(r.text);
                  send('chatgpt', { text: cleaned, model: r.model, timestamp: r.timestamp });
                  return { ...r, text: cleaned };
                })
                .catch((e) => {
                  logger.error('ChatGPT stream error:', e);
                  const fallback = { text: `ChatGPT error: ${e.message}`, model: 'Error', timestamp: new Date() };
                  send('chatgpt', fallback);
                  return fallback;
                })
            : Promise.resolve(
                (() => {
                  const fb = { text: 'ChatGPT not configured', model: 'Not configured', timestamp: new Date() };
                  send('chatgpt', fb);
                  return fb;
                })()
              );

          const [geminiResult, chatgptResult] = await Promise.all([geminiPromise, chatgptPromise]);

          let summary;
          if (hasOpenAI && hasGemini && geminiResult && chatgptResult) {
            try {
              summary = await summarizeResponses(geminiResult.text, chatgptResult.text);
              summary.text = cleanText(summary.text);
            } catch {
              summary = { text: geminiResult.text, model: 'Fallback (summary failed)', timestamp: new Date() };
            }
          } else if (geminiResult) {
            summary = { text: geminiResult.text, model: `${geminiResult.model} (Single source)`, timestamp: new Date() };
          } else {
            summary = { text: chatgptResult.text, model: `${chatgptResult.model} (Single source)`, timestamp: new Date() };
          }

          send('summary', { text: summary.text, model: summary.model, timestamp: summary.timestamp });
          send('done', {});
          controller.close();
        } catch (error) {
          logger.error('Stream error:', error);
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
    logger.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
