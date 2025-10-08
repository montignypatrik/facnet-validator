# Chatbot Module API Documentation
**Phase 1, Step 1.2: Ollama Service Wrapper**

## Overview

The Chatbot module provides an AI-powered medical billing assistant integrated into the Dash platform. It uses Ollama with the Llama 3.2 3B model running locally on the VPS to answer questions about Quebec healthcare billing, RAMQ codes, and medical billing processes.

## Architecture

```
┌─────────────────┐
│  Client (React) │
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│ Express Routes  │  /api/chatbot/*
│  (routes.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Ollama Service  │  ollamaService.query()
│(ollamaService.ts)│
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│  Ollama API     │  127.0.0.1:11434
│ (Llama 3.2 3B)  │
└─────────────────┘
```

## Service Layer

### OllamaService Class

Location: `server/modules/chatbot/services/ollamaService.ts`

#### Methods

##### `query(request: OllamaRequest): Promise<OllamaResponse>`

Send a prompt to the AI and receive a response.

**Parameters:**
```typescript
interface OllamaRequest {
  prompt: string;           // User's question
  model?: string;           // Model to use (default: llama3.2:3b)
  stream?: boolean;         // Stream response (not implemented)
  options?: {
    temperature?: number;   // Response randomness (0-1, default: 0.7)
    top_p?: number;        // Nucleus sampling (default: 0.9)
    max_tokens?: number;   // Max response length (default: 500)
  };
}
```

**Returns:**
```typescript
interface OllamaResponse {
  success: boolean;         // Whether query succeeded
  response?: string;        // Generated text (if success)
  model?: string;           // Model used
  error?: string;           // Error message (if failed)
  metadata?: {
    duration_ms: number;    // Total processing time
    prompt_length: number;  // Input character count
    response_length: number;// Output character count
    model: string;          // Model identifier
    timestamp: string;      // ISO timestamp
  };
}
```

**Example Usage:**
```typescript
import { ollamaService } from './services/ollamaService';

const response = await ollamaService.query({
  prompt: "What is CPT coding?",
  options: {
    temperature: 0.5,  // More focused responses
    max_tokens: 300,
  }
});

if (response.success) {
  console.log(response.response);
  console.log(`Took ${response.metadata.duration_ms}ms`);
} else {
  console.error(response.error);
}
```

##### `healthCheck(): Promise<OllamaHealthCheck>`

Check if Ollama service is running and accessible.

**Returns:**
```typescript
interface OllamaHealthCheck {
  healthy: boolean;    // Service status
  version?: string;    // Ollama version (if healthy)
  error?: string;      // Error message (if unhealthy)
  timestamp: string;   // ISO timestamp
}
```

**Example Usage:**
```typescript
const health = await ollamaService.healthCheck();

if (health.healthy) {
  console.log(`Ollama ${health.version} is running`);
} else {
  console.error(`Ollama is down: ${health.error}`);
}
```

##### `getConfig(): object`

Retrieve current service configuration.

**Returns:**
```typescript
{
  host: string;        // Ollama API URL
  model: string;       // Default model
  timeout: number;     // Request timeout (ms)
  temperature: number; // Default temperature
  max_tokens: number;  // Default max tokens
}
```

## API Endpoints

All endpoints are prefixed with `/api/chatbot`

### POST /api/chatbot/query

Send a question to the medical billing chatbot.

**Request Body:**
```json
{
  "prompt": "What is ICD-10 coding?",
  "model": "llama3.2:3b",  // optional
  "options": {              // optional
    "temperature": 0.7,
    "max_tokens": 500
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "response": "ICD-10 coding is the International Classification of Diseases, 10th Revision...",
  "model": "llama3.2:3b",
  "metadata": {
    "duration_ms": 5234,
    "prompt_length": 23,
    "response_length": 450,
    "model": "llama3.2:3b",
    "timestamp": "2025-10-03T12:34:56.789Z"
  }
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "success": false,
  "error": "Request timed out after 30000ms. The AI model may be busy or overloaded.",
  "metadata": {
    "duration_ms": 30001,
    "prompt_length": 23,
    "response_length": 0,
    "model": "llama3.2:3b",
    "timestamp": "2025-10-03T12:34:56.789Z"
  }
}
```

**Validation Errors (400 Bad Request):**
```json
{
  "success": false,
  "error": "Missing required field: prompt"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:5000/api/chatbot/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What are RAMQ billing codes?"}'
```

**Example Fetch (JavaScript):**
```javascript
const response = await fetch('/api/chatbot/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'What are RAMQ billing codes?',
  }),
});

const data = await response.json();

if (data.success) {
  console.log(data.response);
} else {
  console.error(data.error);
}
```

### GET /api/chatbot/health

Check if Ollama service is healthy.

**Response (200 OK):**
```json
{
  "healthy": true,
  "version": "0.12.3",
  "timestamp": "2025-10-03T12:34:56.789Z"
}
```

**Response (503 Service Unavailable):**
```json
{
  "healthy": false,
  "error": "Cannot connect to Ollama service. Please ensure Ollama is running.",
  "timestamp": "2025-10-03T12:34:56.789Z"
}
```

**Example cURL:**
```bash
curl http://localhost:5000/api/chatbot/health
```

### GET /api/chatbot/config

Get current Ollama service configuration.

**Response (200 OK):**
```json
{
  "host": "http://127.0.0.1:11434",
  "model": "llama3.2:3b",
  "timeout": 30000,
  "temperature": 0.7,
  "max_tokens": 500
}
```

**Example cURL:**
```bash
curl http://localhost:5000/api/chatbot/config
```

### POST /api/chatbot/test

Run comprehensive validation tests on the Ollama service.
**Note:** This endpoint is for development/debugging only.

**Request Body:**
```json
{
  "iterations": 5  // optional, number of sequential requests to test
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "tests": {
    "health_check": {
      "healthy": true,
      "version": "0.12.3",
      "timestamp": "2025-10-03T12:34:56.789Z"
    },
    "simple_query": {
      "success": true,
      "response": "4",
      "metadata": { ... }
    },
    "medical_query": {
      "success": true,
      "response": "CPT coding is...",
      "metadata": { ... }
    },
    "sequential_requests": [
      { "iteration": 1, "success": true, "duration_ms": 5234, "response_length": 450 },
      { "iteration": 2, "success": true, "duration_ms": 4981, "response_length": 423 },
      // ... more iterations
    ],
    "timeout_handling": {
      "success": false,
      "error": "Request timed out after 1ms..."
    }
  },
  "summary": {
    "total_tests": 5,
    "sequential_requests": 5,
    "successful_requests": 5,
    "failed_requests": 0,
    "average_duration_ms": 5123
  }
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:5000/api/chatbot/test \
  -H "Content-Type: application/json" \
  -d '{"iterations": 10}'
```

## Environment Variables

Configure the chatbot module via environment variables in `.env`:

```env
# Ollama Service Configuration
OLLAMA_HOST=http://127.0.0.1:11434   # Ollama API URL (default: localhost)
OLLAMA_MODEL=llama3.2:3b              # Default model to use
OLLAMA_TIMEOUT=30000                  # Request timeout in ms (default: 30s)
OLLAMA_TEMPERATURE=0.7                # Response randomness (0-1, default: 0.7)
OLLAMA_MAX_TOKENS=500                 # Max response length (default: 500)
```

## Medical Billing Context

All user prompts are automatically prefixed with medical billing context:

```
You are a medical billing assistant specialized in Quebec healthcare billing (RAMQ system).
You help healthcare professionals understand:
- RAMQ billing codes and procedures
- CPT and ICD-10 coding standards
- Medical claim submission requirements
- Billing validation rules and compliance
- Quebec-specific healthcare regulations

Provide clear, accurate, and professional answers. If you're unsure about Quebec-specific details, acknowledge it.
```

This ensures responses are relevant to the medical billing domain.

## Error Handling

The service handles various error scenarios:

### Connection Errors
```json
{
  "success": false,
  "error": "Cannot connect to Ollama service. Please ensure Ollama is running."
}
```

### Timeout Errors
```json
{
  "success": false,
  "error": "Request timed out after 30000ms. The AI model may be busy or overloaded."
}
```

### Validation Errors
```json
{
  "success": false,
  "error": "Prompt cannot be empty"
}
```

### HTTP Errors
```json
{
  "success": false,
  "error": "Ollama service error: HTTP 500: Internal Server Error"
}
```

## Performance Metrics

Based on VPS testing (6 vCPU, 12GB RAM, Llama 3.2 3B):

| Metric | Value |
|--------|-------|
| First query (cold start) | 10-20 seconds |
| Subsequent queries (warm) | 5-10 seconds |
| Memory usage (active) | ~4-5 GB |
| Memory usage (idle) | ~200-300 MB |
| Timeout limit | 30 seconds |
| Model cache duration | 5 minutes |

## Testing

### Manual API Tests

```bash
# Health check
curl http://localhost:5000/api/chatbot/health

# Simple query
curl -X POST http://localhost:5000/api/chatbot/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is medical billing?"}'

# Medical billing query
curl -X POST http://localhost:5000/api/chatbot/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain RAMQ billing codes for Quebec."}'

# Run validation tests
curl -X POST http://localhost:5000/api/chatbot/test \
  -H "Content-Type: application/json" \
  -d '{"iterations": 5}'
```

### Automated Test Script

Run the comprehensive validation test suite:

```bash
# Install dependencies
npm install

# Run test script
npm run test:ollama
```

This will validate:
- ✓ Health check responds correctly
- ✓ Simple queries work
- ✓ Empty prompts are rejected
- ✓ Response time is under 30 seconds
- ✓ Sequential requests don't cause memory leaks
- ✓ Medical billing context is applied
- ✓ Configuration is retrievable

## Security Considerations

1. **Localhost Only**: Ollama runs on `127.0.0.1:11434` and is NOT exposed to the internet
2. **No Authentication**: Ollama has no built-in auth, so localhost-only is critical
3. **Rate Limiting**: Consider implementing rate limiting in production
4. **Input Validation**: All prompts are validated before sending to Ollama
5. **Timeout Protection**: 30-second timeout prevents hanging requests
6. **Error Sanitization**: Error messages don't expose internal details

## Next Steps (Phase 1, Step 1.3)

Once the service wrapper is validated:

1. Create React chatbot UI component
2. Implement chat history and conversation threading
3. Add typing indicators and loading states
4. Implement streaming responses for better UX
5. Add conversation context for follow-up questions
6. Create admin panel for monitoring usage/performance

## Troubleshooting

### Service Returns "Cannot connect to Ollama"

```bash
# Check if Ollama is running
sudo systemctl status ollama

# Start Ollama if stopped
sudo systemctl start ollama

# Check Ollama health
curl http://localhost:11434/api/version
```

### Timeouts or Slow Responses

```bash
# Check if model is loaded
curl http://localhost:11434/api/tags

# Pre-warm model (keeps it in memory)
ollama run llama3.2:3b "Hello"

# Check memory usage
free -h
```

### TypeScript Build Errors

```bash
# Rebuild project
npm run build

# Check for syntax errors
npm run check
```

## Support

For issues or questions:
- Check Ollama logs: `sudo journalctl -u ollama -f`
- Check application logs: Server console output
- Review test results: `npm run test:ollama`
- See setup documentation: `docs/OLLAMA_SETUP.md`
