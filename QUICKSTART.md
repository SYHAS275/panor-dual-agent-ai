# Quick Start Guide

Get the AI Document Analyzer up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- OpenAI API key
- Google Gemini API key

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js, React, TypeScript
- Tailwind CSS for styling
- AI SDKs (OpenAI, Google Gemini)
- File processing libraries (pdf-parse, tesseract.js, mammoth)
- Other utilities

### 2. Get Your API Keys

#### OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

#### Google Gemini API Key

1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

### 3. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env file
nano .env
```

Add your keys:

```env
OPENAI_API_KEY=sk-your-openai-key-here
GEMINI_API_KEY=your-gemini-key-here
NODE_ENV=development
MAX_FILE_SIZE=10485760
API_TIMEOUT=60000
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Test the Application

1. Click or drag to upload a test file (PDF, image, DOCX, or TXT)
2. Enter a question like "What is this document about?"
3. Click "Analyze Document"
4. Wait for results from Gemini, ChatGPT, and the final summary

## Common Issues

### "API key not configured"

Make sure your `.env` file exists and has the correct API keys.

### "File type not allowed"

Only these formats are supported:
- PDF (.pdf)
- Images (.png, .jpg, .jpeg)
- Word documents (.docx)
- Text files (.txt)

### "File too large"

Maximum file size is 10MB. Compress or split larger files.

### Port 3000 already in use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or run on different port
PORT=3001 npm run dev
```

## Project Structure

```
ai-document-analyzer/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── FileUpload.tsx    # Upload UI
│   ├── Header.tsx        # Header with dark mode
│   └── ResponseDisplay.tsx # Results display
├── lib/                   # Backend utilities
│   ├── ai/               # AI integrations
│   ├── parsers/          # File parsers
│   ├── config.ts         # Configuration
│   └── logger.ts         # Logging
├── .env                   # Environment variables (create this)
├── package.json          # Dependencies
└── README.md             # Documentation
```

## Next Steps

### Production Build

```bash
npm run build
npm start
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Add Features

Consider adding:
- User authentication (NextAuth.js)
- Database for history (PostgreSQL, MongoDB)
- File storage (AWS S3)
- Rate limiting (Redis)
- Analytics

### Customize

- Update colors in `tailwind.config.ts`
- Modify AI prompts in `lib/config.ts`
- Adjust file size limits in `.env`
- Change models in `lib/config.ts`

## Development Tips

### Hot Reload

Changes to files are automatically reflected in the browser.

### API Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test file upload
curl -X POST http://localhost:3000/api/analyze \
  -F "file=@test.pdf" \
  -F "question=What is this about?"
```

### Logs

Check `error.log` and `combined.log` for debugging.

### Dark Mode

Toggle with the moon/sun icon in the header.

## Resources

- [README.md](README.md) - Full documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [SECURITY.md](SECURITY.md) - Security best practices
- [Next.js Docs](https://nextjs.org/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Gemini API Docs](https://ai.google.dev/docs)

## Support

- GitHub Issues: [Report bugs or request features]
- Documentation: See README.md
- API Status:
  - OpenAI: https://status.openai.com
  - Google: https://status.cloud.google.com

## Quick Reference

### Supported File Types

| Type | Extensions | Parser |
|------|-----------|--------|
| PDF | .pdf | pdf-parse |
| Images | .png, .jpg, .jpeg | Tesseract OCR |
| Word | .docx | mammoth |
| Text | .txt | fs.readFile |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| OPENAI_API_KEY | Yes | - | OpenAI API key |
| GEMINI_API_KEY | Yes | - | Gemini API key |
| MAX_FILE_SIZE | No | 10485760 | Max file size (bytes) |
| API_TIMEOUT | No | 60000 | API timeout (ms) |
| NODE_ENV | No | development | Environment |

### Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## Troubleshooting

### TypeScript Errors

```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### API Errors

1. Check API keys in `.env`
2. Verify API key permissions
3. Check API usage limits
4. Review logs for details

---

Happy coding! If you encounter issues, check the full README.md or open an issue on GitHub.
