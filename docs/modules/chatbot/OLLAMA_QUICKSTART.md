# Ollama Chatbot Quick Start Guide

## ✅ What's Complete

### Phase 1, Step 1.1: Infrastructure Setup
- ✅ Ollama installed on VPS (148.113.196.245)
- ✅ Llama 3.2 3B model downloaded
- ✅ Service running and auto-starts on boot
- ✅ Performance validated (12s response time, 4.4GB memory)

### Phase 1, Step 1.2: Service Wrapper
- ✅ TypeScript service module created
- ✅ Express API endpoints implemented
- ✅ Integrated into modular architecture
- ✅ Documentation complete

## 🚀 Quick Test Commands

### Local Testing (Config Only)
```bash
# Start dev server
npm run dev

# Test configuration endpoint
curl http://localhost:5000/api/chatbot/config

# Expected output:
# {"host":"http://127.0.0.1:11434","model":"llama3.2:3b",...}
```

### Production Testing (After Deployment)
```bash
# SSH to VPS
ssh ubuntu@148.113.196.245

# Test health check
curl http://localhost:5000/api/chatbot/health

# Test simple query
curl -X POST http://localhost:5000/api/chatbot/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is medical billing?"}'

# Run comprehensive test suite
curl -X POST http://localhost:5000/api/chatbot/test \
  -H "Content-Type: application/json" \
  -d '{"iterations": 5}'
```

## 📋 API Endpoints

All endpoints under `/api/chatbot`:

1. **POST /api/chatbot/query** - Send questions to AI
2. **GET /api/chatbot/health** - Check if Ollama is running
3. **GET /api/chatbot/config** - Get service configuration
4. **POST /api/chatbot/test** - Run validation tests

## 📚 Documentation

- **API Reference**: [docs/CHATBOT_API.md](./CHATBOT_API.md)
- **Setup Guide**: [docs/OLLAMA_SETUP.md](./OLLAMA_SETUP.md)
- **Test Results**: [docs/OLLAMA_TEST_RESULTS.md](./OLLAMA_TEST_RESULTS.md)
- **Complete Status**: [docs/PHASE1_STEP1.2_COMPLETE.md](./PHASE1_STEP1.2_COMPLETE.md)

## 🔧 Configuration

Environment variables (`.env`):
```env
OLLAMA_HOST=http://127.0.0.1:11434   # Ollama API URL
OLLAMA_MODEL=llama3.2:3b              # Model to use
OLLAMA_TIMEOUT=30000                  # Timeout (30s)
OLLAMA_TEMPERATURE=0.7                # Response randomness
OLLAMA_MAX_TOKENS=500                 # Max response length
```

## 📊 Performance Metrics

Based on VPS testing:
- **Response Time**: 5-15 seconds (warm), 10-20 seconds (cold)
- **Memory Usage**: 4-5 GB (active), 200-300 MB (idle)
- **Timeout**: 30 seconds max
- **Model Cache**: 5 minutes

## 🚦 Deployment

### Option 1: Deploy to Staging

```bash
# SSH to VPS
ssh ubuntu@148.113.196.245

# Deploy to staging
cd /var/www/facnet/staging
sudo -u facnet git fetch origin
sudo -u facnet git checkout feature/ollama-chatbot-setup
sudo -u facnet git pull origin feature/ollama-chatbot-setup
sudo -u facnet npm install
sudo -u facnet npm run build

# Restart staging
sudo -u facnet PORT=3002 \
  NODE_ENV=staging \
  DATABASE_URL='postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging' \
  pm2 restart facnet-validator-staging

# Test
curl http://localhost:3002/api/chatbot/health
```

### Option 2: Merge to Production

```bash
# Commit changes
git add .
git commit -m "feat: add Ollama chatbot service wrapper"

# Merge to main
git checkout main
git merge feature/ollama-chatbot-setup
git push origin main

# GitHub Actions auto-deploys to production
```

## 🧪 Validation Tests

Run all validation tests:
```bash
npm run test:ollama
```

Tests verify:
- ✅ Health check functionality
- ✅ Simple query processing
- ✅ Empty prompt error handling
- ✅ Response time < 30 seconds
- ✅ Sequential requests (no memory leaks)
- ✅ Medical billing context injection
- ✅ Configuration retrieval

## 🔐 Security

- ✅ Ollama runs on localhost only
- ✅ Not exposed to internet
- ✅ Input validation on all endpoints
- ✅ Timeout protection
- ⚠️ No rate limiting yet (Phase 2)
- ⚠️ No user authentication yet (Phase 2)

## ⏭️ Next Steps (Phase 1, Step 1.3)

1. **Frontend UI**: Create React chatbot component
2. **Chat Interface**: Message history, typing indicators
3. **Streaming**: Implement streaming responses
4. **Context**: Add conversation memory
5. **Auth**: Add Auth0 token validation
6. **Rate Limiting**: Protect against abuse

## 📞 Troubleshooting

### "Cannot connect to Ollama"
```bash
# Check if Ollama is running
sudo systemctl status ollama

# Start if stopped
sudo systemctl start ollama
```

### Slow Responses
```bash
# Pre-warm model
ollama run llama3.2:3b "Hello"

# Check memory
free -h
```

### Module Not Loading
```bash
# Check logs
npm run dev
# Look for: "[MODULE REGISTRY] ✓ Loaded module: chatbot (1.0.0)"
```

## 📁 File Structure

```
server/modules/chatbot/
├── services/
│   └── ollamaService.ts    # Core service wrapper
└── routes.ts                # API endpoints

docs/
├── CHATBOT_API.md           # Complete API reference
├── OLLAMA_SETUP.md          # Infrastructure setup
├── OLLAMA_TEST_RESULTS.md   # Validation results
├── PHASE1_STEP1.2_COMPLETE.md # Status report
└── OLLAMA_QUICKSTART.md     # This file

scripts/
├── install-ollama.sh        # VPS installation script
└── test-ollama-service.ts   # Validation test suite
```

## ✅ Status Summary

**Phase 1, Step 1.2: COMPLETE**

All requirements met:
- [x] Service module created
- [x] Async/await implementation
- [x] Error handling and timeouts
- [x] Health check functionality
- [x] Logging and monitoring
- [x] Test script created
- [x] Documentation complete
- [x] Module integrated
- [x] Ready for deployment

**Ready for**: VPS deployment and production testing
