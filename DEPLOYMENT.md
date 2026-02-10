# Deployment Guide

This guide covers deploying the AI Document Analyzer to various platforms.

## Table of Contents

1. [Vercel (Recommended)](#vercel-deployment)
2. [Netlify](#netlify-deployment)
3. [AWS (EC2 + S3)](#aws-deployment)
4. [Docker](#docker-deployment)
5. [DigitalOcean](#digitalocean-deployment)

---

## Vercel Deployment

Vercel is the recommended platform for Next.js applications.

### Prerequisites

- GitHub, GitLab, or Bitbucket account
- Vercel account (free tier available)

### Steps

1. **Push Code to Git Repository**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/ai-document-analyzer.git
git push -u origin main
```

2. **Deploy to Vercel**

   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your Git repository
   - Configure project:
     - Framework Preset: Next.js
     - Root Directory: ./
     - Build Command: `npm run build`
     - Output Directory: .next

3. **Set Environment Variables**

In Vercel dashboard:
- Go to Project Settings → Environment Variables
- Add the following variables:

```
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-key
NODE_ENV=production
MAX_FILE_SIZE=10485760
API_TIMEOUT=60000
```

4. **Deploy**

Click "Deploy" - Vercel will automatically build and deploy your application.

5. **Custom Domain (Optional)**

- Go to Project Settings → Domains
- Add your custom domain
- Update DNS records as instructed

### Vercel Configuration

Create `vercel.json` in the root directory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "app/api/analyze/route.ts": {
      "maxDuration": 300
    }
  }
}
```

---

## Netlify Deployment

### Steps

1. **Install Netlify CLI**

```bash
npm install -g netlify-cli
```

2. **Build the Project**

```bash
npm run build
```

3. **Create netlify.toml**

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_ENV = "production"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

4. **Deploy**

```bash
netlify deploy --prod
```

5. **Set Environment Variables**

```bash
netlify env:set OPENAI_API_KEY "sk-your-key"
netlify env:set GEMINI_API_KEY "your-key"
```

---

## AWS Deployment

### Prerequisites

- AWS account
- AWS CLI installed and configured
- EC2 instance (t3.medium or higher recommended)

### EC2 Setup

1. **Launch EC2 Instance**

- AMI: Ubuntu Server 22.04 LTS
- Instance Type: t3.medium
- Security Group: Allow HTTP (80), HTTPS (443), SSH (22)

2. **Connect to Instance**

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

3. **Install Node.js**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. **Install PM2**

```bash
sudo npm install -g pm2
```

5. **Clone and Setup**

```bash
git clone https://github.com/yourusername/ai-document-analyzer.git
cd ai-document-analyzer
npm install
```

6. **Create .env File**

```bash
nano .env
# Add your environment variables
```

7. **Build and Start**

```bash
npm run build
pm2 start npm --name "ai-analyzer" -- start
pm2 save
pm2 startup
```

8. **Setup Nginx Reverse Proxy**

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/ai-analyzer
```

Add configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/ai-analyzer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

9. **Setup SSL with Let's Encrypt**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Docker Deployment

### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - MAX_FILE_SIZE=10485760
      - API_TIMEOUT=60000
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped
```

### Build and Run

```bash
# Build image
docker build -t ai-document-analyzer .

# Run container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  -e GEMINI_API_KEY=your-key \
  ai-document-analyzer

# Or use docker-compose
docker-compose up -d
```

---

## DigitalOcean Deployment

### Using App Platform

1. **Create New App**

- Sign in to DigitalOcean
- Click "Create" → "Apps"
- Connect your GitHub repository

2. **Configure App**

- Name: ai-document-analyzer
- Region: Choose closest to your users
- Branch: main
- Build Command: `npm run build`
- Run Command: `npm start`

3. **Environment Variables**

Add in App Platform settings:
```
OPENAI_API_KEY=your-key
GEMINI_API_KEY=your-key
NODE_ENV=production
```

4. **Deploy**

Click "Create Resources" - app will be deployed automatically.

### Using Droplet

Similar to AWS EC2 setup above, but:

```bash
# Create droplet (Ubuntu 22.04)
# SSH into droplet
ssh root@your-droplet-ip

# Follow same steps as EC2 deployment
```

---

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] API keys are valid and have proper permissions
- [ ] SSL/HTTPS is configured
- [ ] File upload size limits are appropriate
- [ ] Error logging is working
- [ ] Health check endpoint returns 200
- [ ] Test file uploads with all supported formats
- [ ] Dark mode works correctly
- [ ] Mobile responsiveness is good
- [ ] Monitor API usage and costs

---

## Monitoring

### Vercel

- Built-in analytics available in dashboard
- Real-time logs in deployment view

### AWS CloudWatch

```bash
# Install CloudWatch agent on EC2
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

### PM2 Monitoring

```bash
pm2 monitor
# Or use PM2 Plus for advanced monitoring
```

---

## Scaling Considerations

1. **API Rate Limits**
   - Implement rate limiting middleware
   - Use Redis for distributed rate limiting

2. **File Storage**
   - Use S3 for file storage instead of local filesystem
   - Implement cleanup job for old files

3. **Caching**
   - Cache AI responses for repeated queries
   - Use Redis or Memcached

4. **Load Balancing**
   - Multiple instances behind load balancer
   - Use AWS ELB or Nginx

5. **Database**
   - Add PostgreSQL or MongoDB for user history
   - Store analysis results for future reference

---

## Troubleshooting

### Deployment Fails

- Check build logs for errors
- Verify all dependencies are in `package.json`
- Ensure Node.js version matches (18+)

### API Timeouts

- Increase timeout in platform settings
- Optimize text extraction process
- Consider async processing with queues

### Out of Memory

- Increase instance size
- Optimize image processing
- Implement streaming for large files

---

## Cost Optimization

1. **API Usage**
   - Monitor OpenAI and Gemini usage
   - Implement caching for repeated queries
   - Set usage limits

2. **Hosting**
   - Start with smallest instance that works
   - Scale up based on traffic
   - Use serverless for variable traffic

3. **Storage**
   - Delete uploaded files after processing
   - Implement file expiration
   - Compress responses before storing

---

## Support

For deployment issues:
- Check logs first
- Verify environment variables
- Test locally with production build
- Open issue on GitHub with detailed error information
