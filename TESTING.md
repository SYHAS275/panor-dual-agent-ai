# Testing Guide

Comprehensive testing guide for the AI Document Analyzer application.

## Table of Contents

1. [Manual Testing](#manual-testing)
2. [Test Cases](#test-cases)
3. [API Testing](#api-testing)
4. [Performance Testing](#performance-testing)
5. [Security Testing](#security-testing)
6. [Browser Testing](#browser-testing)

---

## Manual Testing

### Prerequisites

1. Application running locally:
   ```bash
   npm run dev
   ```

2. API keys configured in `.env`

3. Test files prepared:
   - PDF file (< 10MB)
   - Image file (.png or .jpg)
   - DOCX file
   - TXT file

### Basic Functionality Test

#### Test 1: Upload and Analyze PDF

**Steps:**
1. Open http://localhost:3000
2. Click or drag-drop a PDF file
3. Enter question: "What is the main topic of this document?"
4. Click "Analyze Document"
5. Wait for processing

**Expected Results:**
- ✓ File name displayed
- ✓ Loading indicator appears
- ✓ Three responses displayed:
  - Gemini response
  - ChatGPT response
  - Final summary
- ✓ "Analyze Another Document" button visible

**What to Check:**
- All three responses are different
- Summary combines both responses
- No errors in browser console
- File info is correct

#### Test 2: Upload and Analyze Image

**Steps:**
1. Upload a PNG/JPG with text
2. Ask: "What text is visible in this image?"
3. Analyze

**Expected Results:**
- ✓ OCR extracts text correctly
- ✓ AI responds based on extracted text
- ✓ Processing time: 10-30 seconds

**Common Issues:**
- Poor image quality → low OCR accuracy
- No text in image → error message expected

#### Test 3: Upload DOCX

**Steps:**
1. Upload a Word document
2. Ask: "Summarize this document"
3. Analyze

**Expected Results:**
- ✓ Text extracted from document
- ✓ Formatting removed
- ✓ Content analyzed correctly

#### Test 4: Upload TXT

**Steps:**
1. Upload a text file
2. Ask any relevant question
3. Analyze

**Expected Results:**
- ✓ Fastest processing (no complex parsing)
- ✓ Text read correctly
- ✓ UTF-8 encoding handled

---

## Test Cases

### File Upload Tests

#### TC-001: Valid File Upload

**Input:**
- File: test.pdf (5MB)
- Question: "What is this about?"

**Expected:** ✓ Success

**Status:** [ ] Pass [ ] Fail

---

#### TC-002: File Size Limit

**Input:**
- File: large.pdf (15MB)

**Expected:** ✗ Error: "File size exceeds maximum"

**Status:** [ ] Pass [ ] Fail

---

#### TC-003: Invalid File Type

**Input:**
- File: document.exe

**Expected:** ✗ Rejected by file picker

**Status:** [ ] Pass [ ] Fail

---

#### TC-004: No File Selected

**Input:**
- No file
- Question entered

**Expected:** ✗ Submit button disabled

**Status:** [ ] Pass [ ] Fail

---

#### TC-005: Empty Question

**Input:**
- File selected
- Question: ""

**Expected:** ✗ Submit button disabled

**Status:** [ ] Pass [ ] Fail

---

### AI Response Tests

#### TC-006: Gemini Response

**Input:** Valid PDF + question

**Expected:**
- ✓ Response received
- ✓ Non-empty text
- ✓ Model: "gemini-1.5-pro"

**Status:** [ ] Pass [ ] Fail

---

#### TC-007: ChatGPT Response

**Input:** Valid PDF + question

**Expected:**
- ✓ Response received
- ✓ Non-empty text
- ✓ Model: "gpt-4-turbo-preview"

**Status:** [ ] Pass [ ] Fail

---

#### TC-008: Summary Generation

**Input:** Both AI responses

**Expected:**
- ✓ Combined response
- ✓ Removes duplication
- ✓ Coherent answer

**Status:** [ ] Pass [ ] Fail

---

### Error Handling Tests

#### TC-009: Missing API Key

**Setup:**
1. Remove OPENAI_API_KEY from .env
2. Restart server

**Expected:**
- ✗ Error: "OpenAI API key is not configured"

**Status:** [ ] Pass [ ] Fail

---

#### TC-010: Invalid API Key

**Setup:**
1. Set OPENAI_API_KEY to invalid value
2. Try to analyze

**Expected:**
- ✗ Error: "OpenAI API failed: Invalid API key"

**Status:** [ ] Pass [ ] Fail

---

#### TC-011: Network Timeout

**Setup:**
1. Set API_TIMEOUT to very low value (1000ms)
2. Analyze large document

**Expected:**
- ✗ Error: Timeout message

**Status:** [ ] Pass [ ] Fail

---

#### TC-012: Corrupted File

**Input:** Corrupted PDF file

**Expected:**
- ✗ Error: "Failed to parse PDF"

**Status:** [ ] Pass [ ] Fail

---

### UI/UX Tests

#### TC-013: Dark Mode Toggle

**Steps:**
1. Click moon/sun icon in header
2. Verify theme changes
3. Refresh page
4. Verify theme persists

**Expected:**
- ✓ Smooth transition
- ✓ All elements themed
- ✓ Preference saved

**Status:** [ ] Pass [ ] Fail

---

#### TC-014: Mobile Responsiveness

**Steps:**
1. Open in mobile viewport (375px width)
2. Test file upload
3. Test responses display

**Expected:**
- ✓ Responsive layout
- ✓ Readable text
- ✓ Touch-friendly buttons

**Status:** [ ] Pass [ ] Fail

---

#### TC-015: Loading States

**Steps:**
1. Upload file and analyze
2. Observe loading indicator

**Expected:**
- ✓ Spinner visible
- ✓ Progress steps shown
- ✓ UI disabled during processing

**Status:** [ ] Pass [ ] Fail

---

## API Testing

### Using cURL

#### Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "config": {
    "maxFileSize": 10485760,
    "allowedFileTypes": [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".txt"],
    "hasOpenAIKey": true,
    "hasGeminiKey": true
  }
}
```

#### Test Analyze Endpoint

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "file=@test.pdf" \
  -F "question=What is this document about?"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "file": { ... },
    "extractedText": "...",
    "question": "...",
    "responses": {
      "gemini": { ... },
      "chatgpt": { ... },
      "summary": { ... }
    }
  }
}
```

### Using Postman

1. **Create Collection:** "AI Document Analyzer"

2. **Add Request:** POST /api/analyze
   - Method: POST
   - URL: http://localhost:3000/api/analyze
   - Body: form-data
     - file: [Select file]
     - question: "Your question here"

3. **Add Request:** GET /api/health
   - Method: GET
   - URL: http://localhost:3000/api/health

4. **Save and Run**

### Using JavaScript

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('question', 'What is this about?');

const response = await fetch('/api/analyze', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
console.log(data);
```

---

## Performance Testing

### Response Time Benchmarks

| File Type | Size | Expected Time |
|-----------|------|---------------|
| TXT | 100KB | 5-10s |
| PDF | 1MB | 10-20s |
| DOCX | 500KB | 10-15s |
| Image | 2MB | 15-30s |

### Load Testing

#### Using Apache Bench

```bash
# Install
sudo apt install apache2-utils

# Test health endpoint
ab -n 100 -c 10 http://localhost:3000/api/health

# Results to check:
# - Requests per second
# - Time per request
# - Failed requests (should be 0)
```

#### Using Artillery

```bash
# Install
npm install -g artillery

# Create config
cat > load-test.yml << EOF
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 5

scenarios:
  - name: "Health check"
    flow:
      - get:
          url: "/api/health"
EOF

# Run test
artillery run load-test.yml
```

### Memory Leak Testing

```bash
# Monitor memory during file processing
node --inspect npm run dev

# Open chrome://inspect
# Take heap snapshots before and after uploads
# Compare for memory leaks
```

---

## Security Testing

### Input Validation

#### Test 1: SQL Injection in Question

**Input:**
```
File: test.pdf
Question: '; DROP TABLE users; --
```

**Expected:** ✓ Question processed safely (no DB in this app)

---

#### Test 2: XSS in Question

**Input:**
```
Question: <script>alert('XSS')</script>
```

**Expected:** ✓ Script tags escaped/sanitized

---

#### Test 3: Path Traversal in Filename

**Input:**
```
Filename: ../../etc/passwd.pdf
```

**Expected:** ✓ Blocked or sanitized

---

### File Upload Security

#### Test 4: Executable File Upload

**Attempt:** Upload .exe file

**Expected:** ✗ Rejected by file type validation

---

#### Test 5: Oversized File

**Attempt:** Upload 50MB file

**Expected:** ✗ Rejected with clear error

---

#### Test 6: Malicious PDF

**Attempt:** Upload PDF with embedded JavaScript

**Expected:** ✓ Text extracted safely, script not executed

---

### API Key Exposure

#### Test 7: Check Client-Side Code

**Steps:**
1. View page source
2. Check Network tab
3. Inspect JavaScript files

**Expected:** ✗ No API keys visible

---

#### Test 8: Check API Responses

**Steps:**
1. Make API request
2. Inspect response

**Expected:** ✗ No API keys in response

---

#### Test 9: Check Error Messages

**Steps:**
1. Trigger various errors
2. Check error messages

**Expected:** ✗ No sensitive info leaked

---

## Browser Testing

### Desktop Browsers

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | [ ] Pass |
| Firefox | Latest | [ ] Pass |
| Safari | Latest | [ ] Pass |
| Edge | Latest | [ ] Pass |

### Mobile Browsers

| Browser | Platform | Status |
|---------|----------|--------|
| Chrome | Android | [ ] Pass |
| Safari | iOS | [ ] Pass |
| Firefox | Android | [ ] Pass |

### Features to Test

- ✓ File upload (drag-drop and click)
- ✓ Dark mode toggle
- ✓ Responsive layout
- ✓ Form submission
- ✓ Error messages
- ✓ Loading states

---

## Automated Testing (Optional)

### Setup Jest

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom
```

### Example Unit Test

```typescript
// __tests__/parsers/pdfParser.test.ts
import { parsePDF } from '@/lib/parsers/pdfParser';

describe('PDF Parser', () => {
  it('should extract text from valid PDF', async () => {
    const text = await parsePDF('./test-files/sample.pdf');
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });

  it('should throw error for invalid PDF', async () => {
    await expect(parsePDF('./test-files/invalid.pdf'))
      .rejects.toThrow('Failed to parse PDF');
  });
});
```

### Example Integration Test

```typescript
// __tests__/api/analyze.test.ts
import { POST } from '@/app/api/analyze/route';

describe('/api/analyze', () => {
  it('should analyze document successfully', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.txt'));
    formData.append('question', 'What is this?');

    const response = await POST(formData);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.responses).toBeDefined();
  });
});
```

### Run Tests

```bash
npm test
```

---

## Test Checklist

Before deployment, ensure:

- [ ] All manual tests pass
- [ ] All test cases pass
- [ ] No console errors
- [ ] No memory leaks
- [ ] Security tests pass
- [ ] Cross-browser compatibility verified
- [ ] Mobile responsiveness confirmed
- [ ] Performance benchmarks met
- [ ] Error handling works
- [ ] Dark mode works correctly
- [ ] API keys not exposed
- [ ] File cleanup working
- [ ] Logs are clean
- [ ] Health check returns 200

---

## Reporting Issues

When reporting bugs, include:

1. **Environment:**
   - OS, browser, Node version
   - Development or production

2. **Steps to Reproduce:**
   - Detailed steps
   - File used (if applicable)

3. **Expected vs Actual:**
   - What should happen
   - What actually happened

4. **Logs:**
   - Browser console
   - Server logs (error.log)

5. **Screenshots:**
   - Error messages
   - UI state

---

## Continuous Testing

### Pre-commit Checks

```bash
# Run before each commit
npm run lint
npm run type-check
npm run test
```

### Pre-deployment Checks

```bash
# Full test suite
npm run build
npm run test:e2e
npm run test:security
```

---

## Test Coverage Goals

- Unit Tests: 80%+
- Integration Tests: 60%+
- E2E Tests: Critical paths covered
- Security Tests: All OWASP top 10 addressed

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright E2E Testing](https://playwright.dev/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

Happy Testing! 🧪
