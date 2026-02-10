# Contributing Guide

Thank you for considering contributing to the AI Document Analyzer! This guide will help you get started.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Feature Requests](#feature-requests)
8. [Bug Reports](#bug-reports)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Respecting differing viewpoints
- Accepting constructive criticism
- Focusing on what's best for the community

**Unacceptable behavior includes:**
- Harassment or discrimination
- Trolling or insulting comments
- Publishing others' private information
- Other unprofessional conduct

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- OpenAI API key
- Google Gemini API key
- Code editor (VS Code recommended)

### Development Setup

1. **Fork the Repository**
   ```bash
   # Click "Fork" on GitHub
   # Then clone your fork
   git clone https://github.com/YOUR-USERNAME/ai-document-analyzer.git
   cd ai-document-analyzer
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Open in Browser**
   ```
   http://localhost:3000
   ```

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

---

## Development Workflow

### Creating a Feature Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

- Features: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Performance: `perf/description`
- Refactoring: `refactor/description`

**Examples:**
- `feature/add-audio-support`
- `fix/pdf-parsing-error`
- `docs/update-readme`
- `perf/optimize-ocr`

### Making Changes

1. **Write Code**
   - Follow coding standards
   - Add comments for complex logic
   - Update documentation if needed

2. **Test Your Changes**
   ```bash
   npm run lint
   npm run type-check
   npm run test
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add audio file support"
   ```

4. **Push to GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

---

## Coding Standards

### TypeScript

**Use TypeScript for all new code:**

```typescript
// Good
interface AnalysisResult {
  success: boolean;
  data: ResponseData;
}

// Bad
const result: any = await analyze();
```

**Avoid `any` type:**

```typescript
// Good
function processFile(file: File): Promise<string>

// Bad
function processFile(file: any): any
```

**Use proper typing:**

```typescript
// Good
const responses: AIResponse[] = [];

// Bad
const responses = [];
```

### React Components

**Use functional components:**

```typescript
// Good
export default function FileUpload({ onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  // ...
}

// Avoid class components
```

**Proper prop typing:**

```typescript
interface FileUploadProps {
  onAnalysisComplete: (data: AnalysisResult) => void;
  onError: (error: string) => void;
}

export default function FileUpload({
  onAnalysisComplete,
  onError
}: FileUploadProps) {
  // ...
}
```

### Naming Conventions

**Files:**
- Components: PascalCase (e.g., `FileUpload.tsx`)
- Utilities: camelCase (e.g., `fileUpload.ts`)
- Types: PascalCase (e.g., `types.ts`)

**Variables:**
```typescript
// Good
const userName = 'John';
const MAX_FILE_SIZE = 10485760;
const isValid = true;

// Bad
const UserName = 'John';
const maxfilesize = 10485760;
const valid = true;
```

**Functions:**
```typescript
// Good
function parseDocument() { }
async function fetchData() { }

// Bad
function ParseDocument() { }
function fetch_data() { }
```

### Code Organization

**Import order:**

```typescript
// 1. External libraries
import { useState } from 'react';
import axios from 'axios';

// 2. Internal utilities
import { config } from '@/lib/config';
import logger from '@/lib/logger';

// 3. Components
import Header from '@/components/Header';

// 4. Types
import type { AnalysisResult } from './types';

// 5. Styles (if separate)
import styles from './Component.module.css';
```

**File structure:**

```typescript
// 1. Imports
import { ... } from '...';

// 2. Types/Interfaces
interface Props { }

// 3. Constants
const MAX_SIZE = 1000;

// 4. Component/Function
export default function Component() {
  // Component code
}

// 5. Helper functions (if needed)
function helperFunction() { }
```

### Error Handling

**Always handle errors:**

```typescript
// Good
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed:', error);
  throw new Error('User-friendly message');
}

// Bad
const result = await riskyOperation(); // No error handling
```

**User-friendly error messages:**

```typescript
// Good
throw new Error('Failed to upload file. Please try again.');

// Bad
throw new Error('ENOENT: file not found');
```

### Comments

**Write meaningful comments:**

```typescript
// Good
// Extract text from all pages and combine into single string
const text = pages.map(page => page.text).join('\n');

// Bad
// Loop through pages
const text = pages.map(page => page.text).join('\n');
```

**Document complex functions:**

```typescript
/**
 * Analyzes a document using both Gemini and ChatGPT, then generates
 * a final summarized answer combining both responses.
 *
 * @param question - The question to ask about the document
 * @param extractedText - Text extracted from the uploaded file
 * @returns Object containing responses from both AIs and final summary
 */
export async function analyzeDocument(
  question: string,
  extractedText: string
): Promise<AIAnalysisResult> {
  // Implementation
}
```

### Styling with Tailwind

**Consistent class ordering:**

```typescript
// Layout → Spacing → Sizing → Typography → Colors → Effects
<div className="flex items-center justify-between p-4 w-full text-lg text-gray-900 bg-white rounded-lg shadow-lg">
```

**Use semantic class names for complex styles:**

```typescript
// Good
<button className="btn-primary">Submit</button>

// In globals.css
.btn-primary {
  @apply bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700;
}
```

**Responsive design:**

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

**Feature:**
```
feat(upload): add support for audio files

- Add MP3 and WAV file support
- Integrate audio transcription API
- Update file validation logic
```

**Bug Fix:**
```
fix(parser): handle corrupted PDF files gracefully

Previously, corrupted PDFs would crash the server.
Now they return a user-friendly error message.

Fixes #123
```

**Documentation:**
```
docs(readme): update installation instructions

- Add troubleshooting section
- Update API key setup steps
- Add screenshots
```

### Commit Best Practices

- Write in present tense ("add feature" not "added feature")
- Keep subject line under 50 characters
- Capitalize subject line
- No period at end of subject line
- Separate subject from body with blank line
- Wrap body at 72 characters
- Reference issues in footer

---

## Pull Request Process

### Before Submitting

1. **Update from main:**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

2. **Test thoroughly:**
   ```bash
   npm run lint
   npm run type-check
   npm run build
   npm run test
   ```

3. **Update documentation:**
   - Update README if needed
   - Add JSDoc comments
   - Update CHANGELOG

### Creating Pull Request

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature
   ```

2. **Open PR on GitHub:**
   - Click "New Pull Request"
   - Select your branch
   - Fill in the template

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] All tests passing

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Added tests
- [ ] All tests pass
```

### Review Process

1. **Automated checks:**
   - Linting passes
   - Type checking passes
   - Build succeeds
   - Tests pass

2. **Code review:**
   - At least one approval required
   - Address all comments
   - Make requested changes

3. **Merge:**
   - Squash and merge (preferred)
   - Delete branch after merge

---

## Feature Requests

### Before Requesting

1. **Check existing issues:**
   - Search for similar requests
   - Check roadmap

2. **Consider scope:**
   - Is it aligned with project goals?
   - Is it feasible?

### Creating Feature Request

**Use this template:**

```markdown
## Feature Description
Clear description of the feature

## Problem it Solves
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
Other solutions you've thought about

## Additional Context
Screenshots, mockups, examples
```

---

## Bug Reports

### Before Reporting

1. **Verify it's a bug:**
   - Can you reproduce it?
   - Is it really unexpected behavior?

2. **Check existing issues:**
   - Search for similar bugs
   - Check if it's already fixed

### Creating Bug Report

**Use this template:**

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., Windows 11]
- Browser: [e.g., Chrome 120]
- Node version: [e.g., 18.17.0]
- App version: [e.g., 1.0.0]

## Screenshots
Add screenshots if applicable

## Logs
```
Paste relevant logs here
```

## Additional Context
Any other relevant information
```

---

## Development Tips

### Hot Reload

Changes are automatically reflected. If not working:

```bash
# Restart dev server
npm run dev
```

### Debugging

**Browser DevTools:**
- Console: Check for errors
- Network: Monitor API calls
- Sources: Debug with breakpoints

**Server Logs:**
```bash
# Watch logs in real-time
tail -f combined.log
tail -f error.log
```

**VS Code Debugging:**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    }
  ]
}
```

### Performance Profiling

```typescript
// Add timing logs
const startTime = Date.now();
await longOperation();
const duration = Date.now() - startTime;
logger.info(`Operation took ${duration}ms`);
```

---

## Questions?

- Open a discussion on GitHub
- Check existing documentation
- Ask in pull request comments

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
