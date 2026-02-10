# Security Best Practices

This document outlines security considerations and best practices for the AI Document Analyzer application.

## Table of Contents

1. [API Key Security](#api-key-security)
2. [File Upload Security](#file-upload-security)
3. [Environment Variables](#environment-variables)
4. [Authentication & Authorization](#authentication--authorization)
5. [Data Privacy](#data-privacy)
6. [Rate Limiting](#rate-limiting)
7. [Input Validation](#input-validation)
8. [HTTPS & SSL](#https--ssl)
9. [Security Headers](#security-headers)
10. [Monitoring & Logging](#monitoring--logging)

---

## API Key Security

### Best Practices

1. **Never Commit API Keys**
   ```bash
   # Always in .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use Environment Variables**
   ```typescript
   // Good
   const apiKey = process.env.OPENAI_API_KEY;

   // Bad - Never hardcode
   const apiKey = 'sk-12345...';
   ```

3. **Rotate Keys Regularly**
   - Set up key rotation schedule (every 90 days)
   - Use multiple keys for different environments
   - Revoke compromised keys immediately

4. **Restrict API Key Permissions**
   - OpenAI: Limit to specific endpoints
   - Gemini: Use API restrictions in Google Cloud Console

### Key Management

```typescript
// lib/config.ts
export const validateConfig = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required');
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required');
  }
};
```

---

## File Upload Security

### Implemented Protections

1. **File Type Validation**
   ```typescript
   const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.txt'];
   ```

2. **File Size Limits**
   ```typescript
   maxFileSize: 10485760, // 10MB
   ```

3. **MIME Type Checking**
   ```typescript
   filter: function ({ mimetype, originalFilename }) {
     const ext = path.extname(originalFilename || '').toLowerCase();
     return allowedFileTypes.includes(ext);
   }
   ```

### Additional Recommendations

1. **Virus Scanning**
   ```bash
   npm install clamscan
   ```

   ```typescript
   import NodeClam from 'clamscan';

   const clamscan = await new NodeClam().init();
   const { isInfected } = await clamscan.scanFile(filePath);
   ```

2. **File Content Validation**
   - Verify PDF structure
   - Check image dimensions and format
   - Validate DOCX XML structure

3. **Temporary File Cleanup**
   ```typescript
   // Already implemented
   await unlink(filePath).catch((err) =>
     logger.warn(`Failed to delete file: ${err}`)
   );
   ```

---

## Environment Variables

### Secure Storage

1. **Local Development**
   ```bash
   # .env - never commit
   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=...
   ```

2. **Production**
   - Vercel: Use Environment Variables UI
   - AWS: Use AWS Secrets Manager
   - Docker: Use Docker secrets

### AWS Secrets Manager Integration

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function getSecret(secretName: string) {
  const client = new SecretsManagerClient({ region: "us-east-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return JSON.parse(response.SecretString || '{}');
}
```

---

## Authentication & Authorization

### Current State

Currently, the application has no authentication. For production:

### Recommended Implementation

1. **NextAuth.js**
   ```bash
   npm install next-auth
   ```

2. **Middleware Protection**
   ```typescript
   // middleware.ts
   export { default } from "next-auth/middleware"

   export const config = {
     matcher: ["/api/analyze/:path*"]
   }
   ```

3. **User-based Rate Limiting**
   ```typescript
   // Track usage per user
   const userUsage = await redis.get(`usage:${userId}`);
   if (userUsage > limit) {
     return new Response('Rate limit exceeded', { status: 429 });
   }
   ```

---

## Data Privacy

### File Handling

1. **Temporary Storage Only**
   - Files are deleted immediately after processing
   - No permanent storage of user files

2. **Text Extraction**
   - Only text content is extracted
   - Original files are not retained

3. **API Response Storage**
   - Consider if responses should be logged
   - Implement opt-out for sensitive documents

### GDPR Compliance

```typescript
// Add user consent
interface AnalysisRequest {
  file: File;
  question: string;
  consent: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
  };
}
```

### Data Retention Policy

```typescript
// Implement automatic deletion
const RETENTION_DAYS = 30;

async function cleanupOldData() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  // Delete old logs, responses, etc.
  await db.analysis.deleteMany({
    where: { createdAt: { lt: cutoffDate } }
  });
}
```

---

## Rate Limiting

### Implementation

```typescript
// lib/rateLimit.ts
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: "minute"
});

export async function checkRateLimit(identifier: string) {
  const remainingTokens = await limiter.removeTokens(1);

  if (remainingTokens < 0) {
    throw new Error('Rate limit exceeded');
  }
}
```

### Redis-based Rate Limiting

```typescript
// lib/redisRateLimit.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function rateLimit(ip: string, limit = 10, window = 60) {
  const key = `ratelimit:${ip}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, window);
  }

  if (current > limit) {
    throw new Error('Rate limit exceeded');
  }

  return {
    remaining: limit - current,
    reset: await redis.ttl(key)
  };
}
```

### API Route Implementation

```typescript
// app/api/analyze/route.ts
export async function POST(req: NextRequest) {
  const ip = req.ip || 'unknown';

  try {
    await rateLimit(ip, 10, 60);
  } catch (error) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  // Continue with normal processing...
}
```

---

## Input Validation

### File Validation

```typescript
// Enhanced validation
export function validateFile(file: File): ValidationResult {
  // Check file extension
  const ext = path.extname(file.originalFilename || '').toLowerCase();
  if (!ALLOWED_TYPES.includes(ext)) {
    throw new Error(`Invalid file type: ${ext}`);
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }

  // Check MIME type
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    throw new Error(`Invalid MIME type: ${file.mimetype}`);
  }

  return { valid: true };
}
```

### Question Validation

```typescript
export function validateQuestion(question: string): string {
  // Remove HTML tags
  const sanitized = question.replace(/<[^>]*>/g, '');

  // Limit length
  if (sanitized.length > 1000) {
    throw new Error('Question too long');
  }

  // Check for minimum length
  if (sanitized.length < 3) {
    throw new Error('Question too short');
  }

  return sanitized.trim();
}
```

---

## HTTPS & SSL

### Local Development

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout localhost-key.pem -out localhost.pem
```

### Production

1. **Vercel**: Automatic HTTPS
2. **AWS**: Use AWS Certificate Manager
3. **Let's Encrypt**: Free SSL certificates

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com
```

### Force HTTPS

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' &&
      req.headers.get('x-forwarded-proto') !== 'https') {
    return NextResponse.redirect(
      `https://${req.headers.get('host')}${req.nextUrl.pathname}`,
      301
    );
  }
}
```

---

## Security Headers

### Implementation

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

## Monitoring & Logging

### Secure Logging

```typescript
// lib/logger.ts - Enhanced
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-analyzer' },
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

// Sanitize sensitive data
logger.add(winston.format((info) => {
  if (info.apiKey) {
    info.apiKey = '[REDACTED]';
  }
  return info;
})());

export default logger;
```

### Security Event Logging

```typescript
export function logSecurityEvent(event: SecurityEvent) {
  logger.warn('Security event', {
    type: event.type,
    ip: event.ip,
    timestamp: new Date().toISOString(),
    details: event.details
  });
}

// Usage
logSecurityEvent({
  type: 'invalid_file_type',
  ip: req.ip,
  details: { filename, attempted_type }
});
```

---

## Incident Response

### Plan

1. **Detection**
   - Monitor logs for suspicious activity
   - Set up alerts for unusual patterns

2. **Response**
   - Rotate compromised API keys immediately
   - Block malicious IP addresses
   - Review and patch vulnerabilities

3. **Recovery**
   - Restore from backups if needed
   - Document incident
   - Update security measures

### Emergency Contacts

```typescript
// config/emergency.ts
export const emergencyContacts = {
  security: 'security@yourdomain.com',
  devops: 'devops@yourdomain.com',
  openai: 'support@openai.com',
  google: 'cloud-support@google.com'
};
```

---

## Security Checklist

- [ ] API keys stored in environment variables
- [ ] `.env` file in `.gitignore`
- [ ] File type validation implemented
- [ ] File size limits enforced
- [ ] HTTPS enabled in production
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Temporary files cleaned up
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured and sanitized
- [ ] Regular dependency updates
- [ ] Security monitoring in place
- [ ] Incident response plan documented

---

## Regular Maintenance

### Weekly
- Review error logs
- Check for suspicious activity
- Monitor API usage

### Monthly
- Update dependencies
- Review security headers
- Test rate limiting
- Audit file cleanup process

### Quarterly
- Rotate API keys
- Security audit
- Update documentation
- Review access controls

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [OpenAI Security Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [Google Cloud Security](https://cloud.google.com/security)

---

## Reporting Security Issues

If you discover a security vulnerability, please email security@yourdomain.com instead of using the public issue tracker.
