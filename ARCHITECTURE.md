# System Architecture

Detailed technical architecture of the AI Document Analyzer.

## High-Level Overview

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTPS
       ▼
┌─────────────────────────────────────────┐
│         Next.js Application             │
│  ┌───────────────────────────────────┐  │
│  │      Frontend (React + TS)        │  │
│  │  - File Upload Component          │  │
│  │  - Response Display               │  │
│  │  - Dark Mode Toggle               │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │      API Routes (Next.js)         │  │
│  │  - /api/analyze (POST)            │  │
│  │  - /api/health (GET)              │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │      Backend Services             │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │   File Parser Layer         │  │  │
│  │  │  - PDF Parser               │  │  │
│  │  │  - Image OCR (Tesseract)    │  │  │
│  │  │  - DOCX Parser              │  │  │
│  │  │  - Text Parser              │  │  │
│  │  └─────────────┬───────────────┘  │  │
│  │                │                   │  │
│  │  ┌─────────────▼───────────────┐  │  │
│  │  │    AI Orchestration         │  │  │
│  │  │  - Gemini Service           │  │  │
│  │  │  - OpenAI Service           │  │  │
│  │  │  - Summarization Logic      │  │  │
│  │  └─────────────────────────────┘  │  │
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌──────────────┐    ┌──────────────┐
│  Gemini API  │    │  OpenAI API  │
│   (Google)   │    │   (ChatGPT)  │
└──────────────┘    └──────────────┘
```

## Component Architecture

### Frontend Layer

#### 1. Page Component (`app/page.tsx`)

**Responsibilities:**
- Main application state management
- Coordinate file upload and analysis flow
- Handle errors and loading states

**State:**
```typescript
interface PageState {
  result: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}
```

**Flow:**
1. User interaction → FileUpload component
2. File + question submitted → API call
3. Loading state → display progress
4. Response received → ResponseDisplay component

#### 2. FileUpload Component

**Features:**
- Drag-and-drop file upload (react-dropzone)
- File type and size validation
- Question input with validation
- Submit handling with FormData

**Validation:**
```typescript
- File types: .pdf, .png, .jpg, .jpeg, .docx, .txt
- Max size: 10MB
- Question: 3-1000 characters
```

#### 3. ResponseDisplay Component

**Layout:**
```
┌─────────────────────────────────┐
│    Document Information         │
│  - File name, size, question    │
└─────────────────────────────────┘

┌──────────────┐  ┌──────────────┐
│   Gemini     │  │   ChatGPT    │
│   Response   │  │   Response   │
└──────────────┘  └──────────────┘

┌─────────────────────────────────┐
│    Final Summarized Answer      │
│    (Highlighted/Featured)       │
└─────────────────────────────────┘
```

#### 4. Theme System

**Implementation:**
- next-themes for theme management
- System preference detection
- Persistent user preference
- Smooth transitions

### Backend Layer

#### API Routes

##### POST /api/analyze

**Request Flow:**
```
1. Receive multipart/form-data
   ├─ file: Binary file
   └─ question: String

2. Parse form data (formidable)
   ├─ Validate file type
   ├─ Check file size
   └─ Save to temp directory

3. Extract text
   ├─ Detect file type
   ├─ Route to appropriate parser
   └─ Return extracted text

4. AI Analysis
   ├─ Call Gemini API ──┐
   └─ Call OpenAI API ──┤
                         ├─ Parallel execution
                         └─ Wait for both

5. Summarization
   └─ Send both responses to OpenAI
   └─ Generate final answer

6. Cleanup
   └─ Delete uploaded file

7. Return response
   └─ JSON with all three answers
```

**Response Structure:**
```typescript
{
  success: boolean;
  data: {
    file: {
      name: string;
      size: number;
      type: string;
    };
    extractedText: string;
    question: string;
    responses: {
      gemini: AIResponse;
      chatgpt: AIResponse;
      summary: AIResponse;
    };
  };
  error?: string;
}
```

##### GET /api/health

**Purpose:** Health check and configuration verification

**Response:**
```typescript
{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  config: {
    maxFileSize: number;
    allowedFileTypes: string[];
    hasOpenAIKey: boolean;
    hasGeminiKey: boolean;
  };
}
```

### Parser Layer

#### Architecture

```typescript
interface Parser {
  parse(filePath: string): Promise<string>;
}
```

**Implementations:**

1. **PDF Parser** (`pdfParser.ts`)
   - Library: pdf-parse
   - Extracts text from PDF pages
   - Handles multi-page documents

2. **Image Parser** (`imageParser.ts`)
   - Library: Tesseract.js
   - OCR (Optical Character Recognition)
   - Language: English (configurable)
   - Progress tracking

3. **DOCX Parser** (`docxParser.ts`)
   - Library: mammoth
   - Extracts raw text from Word documents
   - Handles formatting

4. **Text Parser** (`textParser.ts`)
   - Native Node.js fs
   - UTF-8 encoding
   - Simple file read

#### Parser Orchestrator

```typescript
// lib/parsers/index.ts
export async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  const extension = getExtension(filePath);

  switch (extension) {
    case '.pdf': return parsePDF(filePath);
    case '.png':
    case '.jpg':
    case '.jpeg': return parseImage(filePath);
    case '.docx': return parseDOCX(filePath);
    case '.txt': return parseText(filePath);
    default: throw new Error('Unsupported file type');
  }
}
```

### AI Service Layer

#### 1. Gemini Service

**Configuration:**
```typescript
- Model: gemini-1.5-pro
- API: @google/generative-ai
- Temperature: Default
- Max tokens: Default
```

**Prompt Structure:**
```
Based on the following document content, please answer this question: "{question}"

Document Content:
{extractedText}

Please provide a comprehensive and accurate answer.
```

#### 2. OpenAI Service

**Configuration:**
```typescript
- Model: gpt-4-turbo-preview
- Temperature: 0.7
- Max tokens: 2000
- System prompt: Context setting
```

**Prompt Structure:**
```
System: You are a helpful AI assistant that analyzes documents...

User: Based on the following document content, please answer this question: "{question}"

Document Content:
{extractedText}

Please provide a comprehensive and accurate answer.
```

#### 3. Summarization Service

**Purpose:** Combine and refine both AI responses

**Configuration:**
```typescript
- Model: gpt-4-turbo-preview
- Temperature: 0.5 (lower for consistency)
- Max tokens: 2500
```

**Prompt:**
```
You are an expert AI judge. Combine the following two answers into a single high-quality response. Remove duplication, fix mistakes, improve clarity, and produce the best possible final answer.

Gemini's Response:
{geminiResponse}

ChatGPT's Response:
{chatgptResponse}

Provide a comprehensive, accurate, and well-structured final answer that takes the best from both responses.
```

### Utility Layer

#### 1. Logger (`logger.ts`)

**Winston Configuration:**
```typescript
- Levels: error, warn, info, debug
- Format: JSON with timestamp
- Transports:
  - File: error.log (errors only)
  - File: combined.log (all logs)
  - Console: development only
```

**Usage:**
```typescript
logger.info('Processing file', { filename, size });
logger.error('API error', { error, service: 'openai' });
```

#### 2. Configuration (`config.ts`)

**Centralized Settings:**
```typescript
export const config = {
  maxFileSize: env('MAX_FILE_SIZE', 10485760),
  allowedFileTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.txt'],
  apiTimeout: env('API_TIMEOUT', 60000),
  openaiApiKey: env('OPENAI_API_KEY'),
  geminiApiKey: env('GEMINI_API_KEY'),
};
```

#### 3. File Upload Handler (`fileUpload.ts`)

**Formidable Configuration:**
```typescript
{
  uploadDir: './uploads',
  keepExtensions: true,
  maxFileSize: 10MB,
  filter: validateFileType,
}
```

## Data Flow

### Complete Request Flow

```
1. User uploads file + enters question
   │
   ▼
2. Frontend validates input
   │
   ▼
3. FormData created and sent to /api/analyze
   │
   ▼
4. API parses multipart data
   │
   ▼
5. File saved to temp directory
   │
   ▼
6. File type detected by extension
   │
   ▼
7. Appropriate parser selected and executed
   │
   ▼
8. Text extracted from file
   │
   ▼
9. Parallel AI requests initiated
   ├─ Gemini API call
   └─ OpenAI API call
   │
   ▼
10. Both responses received
   │
   ▼
11. Summarization request to OpenAI
   │
   ▼
12. Final summary generated
   │
   ▼
13. Temp file deleted
   │
   ▼
14. Response returned to frontend
   │
   ▼
15. Results displayed in three columns
```

## Performance Optimizations

### 1. Parallel Processing

```typescript
// Both AI services called simultaneously
const [geminiResponse, chatgptResponse] = await Promise.all([
  askGemini(question, text),
  askChatGPT(question, text),
]);
```

**Impact:** ~2x faster than sequential calls

### 2. File Cleanup

```typescript
// Immediate cleanup after processing
await unlink(filePath).catch(logger.warn);
```

**Impact:** Prevents disk space issues

### 3. Lazy Loading

```typescript
// Components loaded on demand
const ResponseDisplay = dynamic(() => import('./ResponseDisplay'));
```

### 4. Code Splitting

Next.js automatically splits code by route and component.

## Security Architecture

### Input Validation

```
Client Side          Server Side
    │                    │
    ▼                    ▼
File type    ────────▶  MIME check
File size    ────────▶  Size validation
Question     ────────▶  Sanitization
```

### API Key Management

```
Environment Variables (.env)
         │
         ▼
    config.ts (validation)
         │
         ▼
    AI Services (usage)
```

**Never exposed to:**
- Frontend code
- API responses
- Logs
- Error messages

### File Security

```
Upload
  │
  ▼
Validate type/size
  │
  ▼
Save to temp directory
  │
  ▼
Process
  │
  ▼
Delete immediately
```

## Scalability Considerations

### Current Limitations

- Single server instance
- Local file storage
- In-memory processing
- No caching

### Scaling Strategy

#### 1. Horizontal Scaling

```
Load Balancer
    │
    ├─ App Instance 1
    ├─ App Instance 2
    └─ App Instance 3
```

**Requirements:**
- Stateless application (✓)
- Shared file storage (needs S3)
- Session management (needs Redis)

#### 2. Vertical Scaling

- Increase server resources
- Good for: 10-100 req/min
- Limits: Single point of failure

#### 3. Microservices (Future)

```
API Gateway
    │
    ├─ File Service (upload/parse)
    ├─ Gemini Service
    ├─ OpenAI Service
    └─ Summary Service
```

### Caching Strategy

**Response Caching:**
```typescript
// Cache key: hash(file_content + question)
const cacheKey = hash(`${extractedText}:${question}`);
const cached = await redis.get(cacheKey);

if (cached) return cached;

// Process and cache
const result = await analyzeDocument(...);
await redis.set(cacheKey, result, 'EX', 3600); // 1 hour
```

## Monitoring & Observability

### Metrics to Track

1. **Application Metrics**
   - Request count
   - Response times
   - Error rates
   - File processing times

2. **AI Metrics**
   - API response times
   - Token usage
   - Error rates by service

3. **Resource Metrics**
   - CPU usage
   - Memory usage
   - Disk space
   - Network I/O

### Logging Strategy

```typescript
// Structured logging with context
logger.info('File processing started', {
  requestId,
  filename,
  filesize,
  filetype,
});

logger.info('AI analysis completed', {
  requestId,
  geminiTime,
  openaiTime,
  totalTime,
});
```

## Technology Choices

### Why Next.js?

- ✓ Full-stack framework (frontend + backend)
- ✓ API routes built-in
- ✓ TypeScript support
- ✓ Excellent developer experience
- ✓ Easy deployment (Vercel)

### Why Tailwind CSS?

- ✓ Utility-first approach
- ✓ Dark mode support
- ✓ Responsive design
- ✓ Small bundle size
- ✓ No CSS conflicts

### Why Tesseract.js for OCR?

- ✓ Client-side or server-side
- ✓ No external API needed
- ✓ Multiple languages
- ✓ Open source
- ✓ Good accuracy

### Alternative: Vision API

```typescript
// For better OCR quality
import vision from '@google-cloud/vision';

const [result] = await client.textDetection(imagePath);
const text = result.fullTextAnnotation.text;
```

**Trade-offs:**
- Better accuracy
- Costs money
- Requires Google Cloud setup

## Future Enhancements

### Short Term (1-2 months)

1. **User Authentication**
   - NextAuth.js integration
   - User sessions
   - Personal history

2. **Database Integration**
   - PostgreSQL or MongoDB
   - Store analysis history
   - User preferences

3. **Enhanced Error Handling**
   - Retry logic for API failures
   - Better error messages
   - Recovery mechanisms

### Medium Term (3-6 months)

1. **Streaming Responses**
   - Real-time AI streaming
   - Progressive display
   - Better UX

2. **Batch Processing**
   - Multiple file upload
   - Queue system
   - Background processing

3. **Advanced Analytics**
   - Usage statistics
   - Popular questions
   - Response quality metrics

### Long Term (6-12 months)

1. **Multi-modal Support**
   - Video transcription
   - Audio files
   - More file formats

2. **Custom AI Models**
   - Fine-tuned models
   - Domain-specific analysis
   - Custom prompts

3. **API for Developers**
   - Public API
   - SDK libraries
   - Documentation

## Conclusion

This architecture provides:
- ✓ Scalability foundation
- ✓ Security best practices
- ✓ Performance optimization
- ✓ Maintainability
- ✓ Extensibility

The modular design allows easy updates and feature additions while maintaining code quality and user experience.
