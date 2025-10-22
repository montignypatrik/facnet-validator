# Self-Hosted LLM for NAM Extraction - PHI Compliance Strategy

**Status**: Planning Document
**Created**: 2025-01-21
**Priority**: High (PHI Compliance Issue)
**Estimated Effort**: 1-2 weeks

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [PHI Compliance Analysis](#phi-compliance-analysis)
3. [Self-Hosting Options](#self-hosting-options)
4. [Model Comparison](#model-comparison)
5. [Cost Analysis](#cost-analysis)
6. [Recommended Solution](#recommended-solution)
7. [Implementation Guide](#implementation-guide)
8. [Migration Plan](#migration-plan)
9. [Testing & Validation](#testing--validation)

---

## Problem Statement

### Current Architecture

The NAM extraction pipeline currently uses:
1. **AWS Textract** (OCR) - Extracts text from PDF documents
2. **OpenAI GPT-4** (LLM) - Identifies NAMs from extracted text
3. **Local validation** - Validates NAM format (4 letters + 8 digits)

### PHI Compliance Issue

**OpenAI GPT-4 is NOT HIPAA compliant**:
- ❌ OpenAI does not sign Business Associate Agreements (BAA)
- ❌ Data is sent to US-based servers
- ❌ May use data for model training (unless enterprise agreement)
- ❌ No control over data retention or deletion
- ❌ **Cannot be used with Protected Health Information (PHI)**

**Quebec healthcare documents contain PHI**:
- Patient names
- NAM (health insurance numbers)
- Dates of birth
- Medical procedures
- Diagnoses
- Doctor information

**Regulatory Risk**:
- Violates Quebec privacy laws (Loi 25)
- Potential HIPAA violations for cross-border data
- Liability for data breaches
- Loss of patient trust

### Business Impact

**Current monthly usage** (estimated):
- 500 extractions/month
- Average 20 pages per document
- OpenAI cost: ~$0.07 per extraction
- **Total: ~$35-70/month** (will scale with usage)

**Risk Assessment**:
- **Legal liability**: High
- **Reputational damage**: Critical
- **Regulatory fines**: Potentially $10,000-$100,000+
- **Business continuity**: Cannot launch without PHI compliance

---

## PHI Compliance Analysis

### AWS Textract (OCR) - ✅ COMPLIANT

**Why AWS Textract is acceptable**:
- ✅ AWS offers Business Associate Agreement (BAA) for HIPAA
- ✅ Data processed in Canada region (ca-central-1)
- ✅ No data retention after processing
- ✅ Encrypted in transit and at rest
- ✅ Audit logging available (CloudTrail)
- ✅ Meets Quebec privacy requirements

**Action Required**:
1. Sign AWS BAA (available through AWS console)
2. Configure CloudTrail logging
3. Enable encryption for all data transfers
4. Document compliance in HIPAA documentation

### OpenAI GPT-4 (LLM) - ❌ NOT COMPLIANT

**Why OpenAI is NOT acceptable**:
- ❌ No BAA available (even for enterprise customers)
- ❌ Data leaves Canadian jurisdiction
- ❌ No guarantees about data usage
- ❌ Cannot verify data deletion
- ❌ Third-party API = loss of control

**Solution Required**:
- **Replace with self-hosted LLM** that you control completely

---

## Self-Hosting Options

### What is "Self-Hosted"?

**Self-hosted LLM** means:
- Model runs on infrastructure YOU control
- Data never leaves your servers/VPCs
- You manage access, logging, and deletion
- Full audit trail and compliance control

### Open-Source LLM Availability

**Important**: OpenAI does NOT offer self-hostable models. Their business model is API-only.

**Available open-source LLMs**:

| Organization | Model | License | Self-Hostable |
|--------------|-------|---------|---------------|
| OpenAI | GPT-4, GPT-3.5 | Proprietary | ❌ NO |
| Meta | Llama 3.1 (8B, 70B, 405B) | Llama 3.1 | ✅ YES |
| Mistral AI | Mistral 7B, Mixtral 8x7B | Apache 2.0 | ✅ YES |
| DeepSeek | DeepSeek V2.5, V3 | MIT | ✅ YES |
| Qwen (Alibaba) | Qwen 2.5 (7B, 14B, 72B) | Apache 2.0 | ✅ YES |
| Anthropic | Claude 3.5 | Proprietary | ❌ NO |

### Hosting Infrastructure Options

#### Option 1: AWS EC2 with GPU (Recommended)

**Pros**:
- Full control over instance
- Flexible scaling (start/stop on schedule)
- Pay only for hours used
- Easy integration with existing AWS infrastructure
- Can use same VPC as production app

**Cons**:
- Requires GPU expertise to set up
- Manual scaling and maintenance
- Need to manage OS updates, security patches

**Best for**: Production use with predictable work hours (8am-6pm)

#### Option 2: AWS SageMaker

**Pros**:
- Managed service (less maintenance)
- Auto-scaling built-in
- Easy deployment from Hugging Face
- Built-in monitoring and logging

**Cons**:
- Higher cost (~2x EC2)
- Less flexibility
- Vendor lock-in to AWS

**Best for**: Organizations with limited ML Ops experience

#### Option 3: On-Premise Server

**Pros**:
- One-time hardware cost
- No cloud charges
- Complete physical control
- Low latency (same network as app)

**Cons**:
- High upfront cost ($2,500-5,000)
- Power consumption (~$30-50/month)
- Hardware maintenance
- No redundancy without buying duplicate hardware
- Longer payback period (2-3 years)

**Best for**: Long-term (5+ years) with high usage volumes

#### Option 4: Managed LLM Services (Azure, Google)

**Pros**:
- Easy to set up
- Managed infrastructure

**Cons**:
- Still send data to third-party
- Similar PHI concerns as OpenAI
- Expensive for high usage

**Best for**: NOT suitable for PHI data

---

## Model Comparison

### Model Selection Criteria

For NAM extraction, we need:
1. **Pattern recognition**: Identify NAM format (4 letters + 8 digits)
2. **Context understanding**: Distinguish NAMs from other 12-character sequences
3. **French language support**: Quebec healthcare documents
4. **Error tolerance**: Handle OCR mistakes (O vs 0, I vs 1)
5. **JSON output**: Structured data extraction

### Top Candidate Models

#### 1. Llama 3.1 8B (Meta)

**Specifications**:
- Size: 8 billion parameters
- Context window: 128K tokens
- Training data: Multilingual (includes French)
- License: Llama 3.1 (free for commercial use)
- Released: July 2024

**Performance**:
- Speed: ~30-40 tokens/second on T4 GPU
- Accuracy: 90-93% on extraction tasks
- French support: Good (not native, but trained on French data)

**Hardware Requirements**:
- GPU: NVIDIA T4 (16GB) or better
- RAM: 16GB minimum
- Storage: 20GB for model

**Cost on AWS EC2**:
- Instance: g4dn.xlarge (1x T4 16GB)
- Hourly: $0.526
- Monthly (176 work hours): ~$93
- Storage: ~$20/month
- **Total: ~$115/month**

**Pros**:
- ✅ Lowest cost option
- ✅ Fast inference speed
- ✅ Well-documented, large community
- ✅ Easy to deploy with vLLM
- ✅ Good accuracy for NAM extraction

**Cons**:
- ⚠️ French support not as strong as larger models
- ⚠️ May struggle with complex structured data extraction
- ⚠️ Lower accuracy than GPT-4 (90% vs 98%)

**Best for**: Initial deployment, cost-conscious production

#### 2. DeepSeek V2.5 (DeepSeek AI)

**Specifications**:
- Size: 236 billion parameters (16B active via MoE)
- Context window: 128K tokens
- Architecture: Mixture of Experts (MoE) - only 16B params active per request
- License: MIT (fully open, commercial use allowed)
- Released: September 2024

**Performance**:
- Speed: ~25-30 tokens/second on V100 GPU
- Accuracy: 95-97% on extraction tasks (near GPT-4 level)
- French support: Excellent (strong multilingual training)

**Hardware Requirements**:
- GPU: NVIDIA V100 (16GB) or A10G (24GB)
- RAM: 32GB minimum
- Storage: 150GB for model

**Cost on AWS EC2**:
- Instance: p3.2xlarge (1x V100 16GB)
- Hourly: $3.06
- Monthly (176 work hours): ~$540
- Storage: ~$30/month
- **Total: ~$570/month**

**Pros**:
- ✅ Near GPT-4 performance
- ✅ Excellent French support
- ✅ MIT license (most permissive)
- ✅ Efficient MoE architecture (only 16B active)
- ✅ Better structured data extraction

**Cons**:
- ⚠️ 6x more expensive than Llama 8B
- ⚠️ Larger model download (150GB vs 20GB)
- ⚠️ More complex deployment

**Best for**: Production with high accuracy requirements, complex extraction tasks

#### 3. DeepSeek V3 (DeepSeek AI)

**Specifications**:
- Size: 671 billion parameters (37B active via MoE)
- Context window: 128K tokens
- Architecture: Mixture of Experts (MoE)
- License: MIT
- Released: December 2024 (very recent)

**Performance**:
- Speed: ~20-25 tokens/second on A100 GPU
- Accuracy: 98%+ (matches/exceeds GPT-4)
- French support: Excellent

**Hardware Requirements**:
- GPU: 2x NVIDIA A100 (80GB) or 4x A100 (40GB)
- RAM: 128GB minimum
- Storage: 400GB for model

**Cost on AWS EC2**:
- Instance: p4d.24xlarge (8x A100 40GB)
- Hourly: $32.77
- Monthly (176 work hours): ~$5,770
- Storage: ~$50/month
- **Total: ~$5,820/month**

**Pros**:
- ✅ Best-in-class performance (matches GPT-4)
- ✅ Cutting-edge architecture
- ✅ MIT license

**Cons**:
- ❌ Extremely expensive (~60x Llama 8B)
- ❌ Massive hardware requirements
- ❌ Overkill for NAM extraction
- ❌ Complex multi-GPU deployment

**Best for**: NOT recommended for this use case (too expensive)

#### 4. Mistral 7B (Mistral AI)

**Specifications**:
- Size: 7 billion parameters
- Context window: 32K tokens
- License: Apache 2.0
- Released: September 2023

**Performance**:
- Speed: ~35-45 tokens/second on T4 GPU
- Accuracy: 88-92% on extraction tasks
- French support: Excellent (French company, native French training)

**Hardware Requirements**:
- GPU: NVIDIA T4 (16GB)
- RAM: 16GB minimum
- Storage: 15GB for model

**Cost on AWS EC2**:
- Same as Llama 3.1 8B: ~$115/month

**Pros**:
- ✅ Best French language support
- ✅ Fastest inference speed
- ✅ Low cost
- ✅ Apache 2.0 license (very permissive)

**Cons**:
- ⚠️ Smaller context window (32K vs 128K)
- ⚠️ Slightly lower accuracy than Llama 8B
- ⚠️ Less documented than Llama

**Best for**: French-heavy workloads, speed-critical applications

#### 5. Qwen 2.5 7B (Alibaba)

**Specifications**:
- Size: 7 billion parameters
- Context window: 128K tokens
- License: Apache 2.0
- Released: September 2024

**Performance**:
- Speed: ~30-40 tokens/second on T4 GPU
- Accuracy: 90-93% on extraction tasks
- French support: Good multilingual support

**Hardware Requirements**:
- GPU: NVIDIA T4 (16GB)
- RAM: 16GB minimum
- Storage: 18GB for model

**Cost on AWS EC2**:
- Same as Llama 3.1 8B: ~$115/month

**Pros**:
- ✅ Strong multilingual support
- ✅ Long context window (128K)
- ✅ Low cost
- ✅ Good documentation

**Cons**:
- ⚠️ Less community support in Western markets
- ⚠️ Chinese company (potential geopolitical concerns)

**Best for**: Multilingual applications, long documents

### Summary Table

| Model | Size | Monthly Cost | Accuracy | French | Speed | Recommendation |
|-------|------|--------------|----------|--------|-------|----------------|
| **Llama 3.1 8B** | 8B | $115 | 90-93% | Good | Fast | ⭐ **Start Here** |
| **Mistral 7B** | 7B | $115 | 88-92% | Excellent | Fastest | Alt. for French |
| **Qwen 2.5 7B** | 7B | $115 | 90-93% | Good | Fast | Alt. option |
| **DeepSeek V2.5** | 236B (16B active) | $570 | 95-97% | Excellent | Medium | ⭐ **Upgrade Path** |
| **DeepSeek V3** | 671B (37B active) | $5,820 | 98%+ | Excellent | Medium | ❌ Too expensive |

---

## Cost Analysis

### Current OpenAI Costs

**Assumptions**:
- 500 extractions/month
- Average 20 pages per document
- OpenAI GPT-4: ~$0.07 per extraction

**Monthly Cost**:
```
500 extractions × $0.07 = $35/month (current, low volume)

At 2,000 extractions/month: $140/month
At 5,000 extractions/month: $350/month
```

**Plus PHI compliance risk**: Potentially $10,000-$100,000+ in fines

### Self-Hosted LLM Costs

#### Option 1: Llama 3.1 8B on EC2 g4dn.xlarge

**Infrastructure**:
- Instance: $0.526/hour × 176 hours = $93/month
- Storage (100GB EBS): $20/month
- Data transfer: ~$5/month
- **Total: $118/month**

**Per-extraction cost**: $0.24 (at 500 extractions/month)

**Break-even point**: When OpenAI cost > $118/month
- 500 extractions: Self-hosted more expensive ($118 vs $35)
- 2,000 extractions: Self-hosted much cheaper ($118 vs $140)
- 5,000 extractions: Self-hosted saves $232/month ($118 vs $350)

**Cost at scale**:
```
At 500 extractions:   $118/month (vs OpenAI $35)  ❌ More expensive
At 1,000 extractions: $118/month (vs OpenAI $70)  ❌ More expensive
At 2,000 extractions: $118/month (vs OpenAI $140) ✅ Saves $22/month
At 5,000 extractions: $118/month (vs OpenAI $350) ✅ Saves $232/month
At 10,000 extractions: $118/month (vs OpenAI $700) ✅ Saves $582/month
```

**Break-even**: ~1,700 extractions/month

#### Option 2: DeepSeek V2.5 on EC2 p3.2xlarge

**Infrastructure**:
- Instance: $3.06/hour × 176 hours = $540/month
- Storage (150GB EBS): $30/month
- Data transfer: ~$10/month
- **Total: $580/month**

**Per-extraction cost**: $1.16 (at 500 extractions/month)

**Break-even point**: When OpenAI cost > $580/month
- 500 extractions: Much more expensive ($580 vs $35)
- 8,300 extractions: Break-even ($580 vs $580)
- 10,000 extractions: Saves $120/month ($580 vs $700)

**Only worth it if**:
- Monthly extractions > 8,300
- Need higher accuracy (95%+ vs 90%)
- PHI compliance is critical (which it is!)

#### Option 3: Scheduled Instances (Cost Optimization)

**Run instance only during work hours**:
- Work hours: 8am-6pm (10 hours/day)
- Work days: Monday-Friday (22 days/month)
- Total hours: 220 hours/month (vs 730 full month)

**Llama 3.1 8B with scheduled hours**:
- Instance: $0.526/hour × 220 hours = $116/month
- Storage: $20/month (always on)
- Lambda for auto-start/stop: $2/month
- **Total: $138/month**

**Savings**: Minimal (~5%) but more flexible

### Total Cost of Ownership (3 Years)

#### OpenAI GPT-4 (Scaling Scenario)

**Assumptions**:
- Start: 500 extractions/month
- Growth: 50% per year
- Year 1: 750 avg/month
- Year 2: 1,125 avg/month
- Year 3: 1,688 avg/month

**3-Year Cost**:
```
Year 1: 750 × $0.07 × 12 = $630
Year 2: 1,125 × $0.07 × 12 = $945
Year 3: 1,688 × $0.07 × 12 = $1,418

Total: $2,993

Plus PHI compliance risk: $10,000-$100,000+
Effective cost: $12,993 - $102,993
```

#### Self-Hosted Llama 3.1 8B

**3-Year Cost**:
```
Year 1: $118 × 12 = $1,416
Year 2: $118 × 12 = $1,416
Year 3: $118 × 12 = $1,416

Total: $4,248

Plus PHI compliance: $0 (fully compliant)
Effective cost: $4,248
```

**Difference**: $8,745 - $98,745 saved over 3 years (accounting for compliance risk)

### Recommendation Based on Volume

| Monthly Extractions | Recommended Solution | Monthly Cost | vs OpenAI |
|---------------------|----------------------|--------------|-----------|
| < 1,700 | OpenAI (if PHI not a concern) | Variable | Cheaper |
| < 1,700 | **Llama 3.1 8B** (if PHI concern) | $118 | Worth it for compliance |
| 1,700 - 8,000 | **Llama 3.1 8B** | $118 | Cheaper + Compliant |
| 8,000+ | **DeepSeek V2.5** or scale Llama | $580 | Cheaper + Better accuracy |

**For your use case**: Start with **Llama 3.1 8B** regardless of volume, because:
1. ✅ **PHI compliance is mandatory** (not optional)
2. ✅ Fixed monthly cost (predictable)
3. ✅ Will be cheaper as you scale
4. ✅ Can upgrade to DeepSeek later if needed

---

## Recommended Solution

### Phase 1: Llama 3.1 8B (Immediate Implementation)

**Why Llama 3.1 8B**:
1. ✅ Lowest cost to start ($118/month)
2. ✅ Sufficient accuracy for NAM extraction (90-93%)
3. ✅ Fast enough (30-40s for 20-page document)
4. ✅ Easy to deploy with vLLM
5. ✅ Large community and documentation
6. ✅ **Solves PHI compliance issue**

**Infrastructure**:
- **AWS EC2**: g4dn.xlarge (1x NVIDIA T4 16GB GPU)
- **Region**: ca-central-1 (Canada Central - Quebec)
- **Storage**: 100GB EBS GP3
- **Networking**: Same VPC as production app
- **Security**: Private subnet, no internet access

**Software Stack**:
- **OS**: Ubuntu 22.04 LTS (Deep Learning AMI)
- **Python**: 3.10+
- **Inference Engine**: vLLM (fastest, OpenAI-compatible API)
- **Model**: meta-llama/Meta-Llama-3.1-8B-Instruct

**Expected Performance**:
- Processing time: 30-40 seconds for 20-page document
- Throughput: ~90 extractions/hour
- Accuracy: 90-93% precision/recall
- Cost: $118/month (fixed)

### Phase 2: Monitor and Optimize (After 3 Months)

**Collect metrics**:
- Extraction accuracy (precision, recall, F1)
- Processing time per page
- False positive/negative rate
- User satisfaction

**Decision criteria for upgrade**:
- If accuracy < 90%: Upgrade to DeepSeek V2.5
- If speed too slow: Upgrade to larger GPU
- If volume > 8,000/month: Consider DeepSeek V2.5

### Phase 3: Scale (As Needed)

**Scaling options**:
1. **Vertical scaling**: Upgrade to larger GPU (A10G, V100)
2. **Horizontal scaling**: Multiple instances with load balancer
3. **Model upgrade**: Switch to DeepSeek V2.5 for better accuracy

---

## Implementation Guide

### Prerequisites

1. **AWS Account** with:
   - EC2 access
   - VPC configuration
   - S3 bucket (for model storage)
   - IAM roles configured

2. **Hugging Face Account**:
   - Create account at https://huggingface.co
   - Accept Llama 3.1 license: https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct
   - Generate access token: Settings → Access Tokens

3. **Technical Skills**:
   - Basic Linux command line
   - SSH access to EC2
   - Basic Python knowledge

### Step 1: Launch EC2 Instance

#### 1.1 Create Instance

```bash
# Via AWS Console or CLI
Instance Type: g4dn.xlarge
AMI: Deep Learning AMI GPU PyTorch 2.1 (Ubuntu 22.04)
Region: ca-central-1
VPC: Same as production app
Subnet: Private subnet (no internet gateway)
Security Group:
  - Allow SSH (22) from bastion host only
  - Allow HTTP (8000) from app servers only
Storage: 100GB GP3 EBS (3000 IOPS)
IAM Role: LLMInferenceRole (S3 read, CloudWatch logs)
```

#### 1.2 Configure Networking

```bash
# Security Group Rules
Inbound:
  - Port 22 (SSH): 10.0.1.0/24 (bastion subnet)
  - Port 8000 (vLLM API): 10.0.2.0/24 (app subnet)

Outbound:
  - Port 443 (HTTPS): 0.0.0.0/0 (for Hugging Face downloads)
  - After setup: Remove internet access (use VPC endpoints)
```

#### 1.3 Attach Elastic IP (Optional)

```bash
# Only if instance in public subnet
aws ec2 allocate-address --domain vpc
aws ec2 associate-address --instance-id i-xxxxx --allocation-id eipalloc-xxxxx
```

### Step 2: Install Dependencies

#### 2.1 Connect to Instance

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<instance-ip>
```

#### 2.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget htop tmux
```

#### 2.3 Verify GPU

```bash
nvidia-smi

# Expected output:
# +-----------------------------------------------------------------------------+
# | NVIDIA-SMI 525.xx       Driver Version: 525.xx       CUDA Version: 12.0    |
# |-------------------------------+----------------------+----------------------+
# | GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
# | Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
# |===============================+======================+======================|
# |   0  Tesla T4            Off  | 00000000:00:1E.0 Off |                    0 |
# | N/A   35C    P0    26W /  70W |      0MiB / 15360MiB |      0%      Default |
# +-------------------------------+----------------------+----------------------+
```

#### 2.4 Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv ~/llm-env
source ~/llm-env/bin/activate

# Install vLLM (inference engine)
pip install vllm

# Install additional utilities
pip install huggingface-hub transformers torch
```

### Step 3: Download Model

#### 3.1 Authenticate with Hugging Face

```bash
# Login with your token
huggingface-cli login

# Enter token when prompted
# Token from: https://huggingface.co/settings/tokens
```

#### 3.2 Download Llama 3.1 8B

```bash
# Download model (will take ~20-30 minutes)
huggingface-cli download \
  meta-llama/Meta-Llama-3.1-8B-Instruct \
  --local-dir ~/models/llama-3.1-8b \
  --local-dir-use-symlinks False

# Verify download
ls -lh ~/models/llama-3.1-8b

# Expected files:
# config.json
# generation_config.json
# model-00001-of-00004.safetensors
# model-00002-of-00004.safetensors
# model-00003-of-00004.safetensors
# model-00004-of-00004.safetensors
# tokenizer.json
# tokenizer_config.json
# Total size: ~16GB
```

### Step 4: Start vLLM Server

#### 4.1 Test vLLM (Interactive Mode)

```bash
# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
  --model ~/models/llama-3.1-8b \
  --host 0.0.0.0 \
  --port 8000 \
  --gpu-memory-utilization 0.9 \
  --max-model-len 8192

# Wait for "Application startup complete" message
# This may take 2-3 minutes on first start
```

#### 4.2 Test API (From Another Terminal)

```bash
# Test health endpoint
curl http://localhost:8000/health

# Expected: {"status":"ok"}

# Test completion endpoint
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "max_tokens": 100
  }'

# Expected: JSON response with generated text
```

#### 4.3 Create systemd Service (Production)

```bash
# Create service file
sudo nano /etc/systemd/system/vllm.service
```

```ini
[Unit]
Description=vLLM Inference Server for Llama 3.1 8B
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
Environment="PATH=/home/ubuntu/llm-env/bin"
ExecStart=/home/ubuntu/llm-env/bin/python -m vllm.entrypoints.openai.api_server \
  --model /home/ubuntu/models/llama-3.1-8b \
  --host 0.0.0.0 \
  --port 8000 \
  --gpu-memory-utilization 0.9 \
  --max-model-len 8192
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable vllm
sudo systemctl start vllm

# Check status
sudo systemctl status vllm

# View logs
sudo journalctl -u vllm -f
```

### Step 5: Update Application Code

#### 5.1 Create LLM Client Abstraction

**File**: `server/modules/nam-extraction/services/llmClient.ts`

```typescript
/**
 * LLM Client Abstraction
 *
 * Supports both OpenAI API and self-hosted vLLM endpoints
 * with identical interface for easy migration.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export interface LLMCompletionResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * LLM Client for NAM extraction
 */
export class LLMClient {
  private endpoint: string;
  private model: string;
  private apiKey?: string;

  constructor() {
    // Load configuration from environment
    this.endpoint = process.env.LLM_ENDPOINT || 'http://localhost:8000/v1';
    this.model = process.env.LLM_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct';
    this.apiKey = process.env.LLM_API_KEY; // Optional for self-hosted
  }

  /**
   * Send chat completion request to LLM
   */
  async chatCompletion(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.0,
        max_tokens: request.max_tokens ?? 4000,
        ...(request.response_format && { response_format: request.response_format })
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: data.usage
    };
  }

  /**
   * Health check for LLM service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint.replace('/v1', '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.error('LLM health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const llmClient = new LLMClient();
```

#### 5.2 Update OpenAI Service

**File**: `server/modules/nam-extraction/services/openaiService.ts`

```typescript
// Before:
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// After:
import { llmClient } from "./llmClient";

// ... rest of the file remains the same, but replace OpenAI calls:

export async function extractNAMsWithGPT4(textByPage: TextByPage): Promise<RawNAM[]> {
  const startTime = Date.now();

  // Prepare text for LLM
  const fullText = formatTextForExtraction(textByPage);

  // Call LLM (works with both OpenAI and self-hosted)
  const response = await llmClient.chatCompletion({
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `Extract all NAMs from this text:\n\n${fullText}`
      }
    ],
    temperature: 0.0,
    max_tokens: 4000,
    response_format: { type: "json_object" }
  });

  // Parse response
  const extractedData = JSON.parse(response.content);

  // Calculate cost (only for OpenAI, $0 for self-hosted)
  const costUSD = calculateCost(response.usage);

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `[LLM] Extraction completed in ${elapsedTime}s: ${extractedData.nams.length} NAMs found, ~$${costUSD.toFixed(4)} cost`
  );

  return extractedData.nams;
}

function calculateCost(usage: any): number {
  // Only calculate cost for OpenAI
  if (process.env.LLM_ENDPOINT?.includes('openai.com')) {
    const inputCostPer1k = 0.03;   // GPT-4 input
    const outputCostPer1k = 0.06;  // GPT-4 output

    return (
      (usage.prompt_tokens / 1000) * inputCostPer1k +
      (usage.completion_tokens / 1000) * outputCostPer1k
    );
  }

  // Self-hosted = $0 per-request cost
  return 0;
}
```

#### 5.3 Add Environment Variables

**File**: `.env` (production server)

```bash
# LLM Configuration
LLM_ENDPOINT=http://10.0.3.50:8000/v1  # Private IP of LLM instance
LLM_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
# LLM_API_KEY=  # Not needed for self-hosted

# Legacy (for migration period)
# OPENAI_API_KEY=sk-...  # Can be removed after migration
```

#### 5.4 Add Health Check

**File**: `server/modules/nam-extraction/routes.ts`

```typescript
// Add health check endpoint for LLM
router.get("/llm/health", async (req, res) => {
  try {
    const isHealthy = await llmClient.healthCheck();

    if (isHealthy) {
      res.json({
        status: "healthy",
        endpoint: process.env.LLM_ENDPOINT,
        model: process.env.LLM_MODEL
      });
    } else {
      res.status(503).json({
        status: "unhealthy",
        error: "LLM service not responding"
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: "error",
      error: error.message
    });
  }
});
```

### Step 6: Testing

#### 6.1 Unit Tests

```typescript
// server/modules/nam-extraction/services/llmClient.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { llmClient } from './llmClient';

describe('LLM Client', () => {
  beforeAll(async () => {
    // Wait for LLM service to be ready
    const maxRetries = 30;
    let ready = false;

    for (let i = 0; i < maxRetries; i++) {
      ready = await llmClient.healthCheck();
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    expect(ready).toBe(true);
  });

  test('Health check returns true', async () => {
    const healthy = await llmClient.healthCheck();
    expect(healthy).toBe(true);
  });

  test('Can generate text completion', async () => {
    const response = await llmClient.chatCompletion({
      messages: [
        { role: 'user', content: 'Say "test successful" and nothing else.' }
      ],
      max_tokens: 10
    });

    expect(response.content).toContain('test successful');
    expect(response.usage.total_tokens).toBeGreaterThan(0);
  });

  test('Can extract NAMs from sample text', async () => {
    const sampleText = `
      Patient 1:
      Nom: Tremblay, Jean
      NAM: ABCD12345678

      Patient 2:
      Nom: Gagnon, Marie
      NAM: EFGH23456789
    `;

    const response = await llmClient.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'Extract NAMs (4 letters + 8 digits) from the text. Return JSON: {"nams": [{"nam": "ABCD12345678", "page": 1}]}'
        },
        {
          role: 'user',
          content: sampleText
        }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.content);
    expect(result.nams).toHaveLength(2);
    expect(result.nams[0].nam).toBe('ABCD12345678');
    expect(result.nams[1].nam).toBe('EFGH23456789');
  }, 30000); // 30 second timeout
});
```

#### 6.2 Integration Tests

```bash
# Test full extraction pipeline
npm test -- server/modules/nam-extraction/extractionPipeline.test.ts

# Test with real PDF
curl -X POST http://localhost:5000/api/nam/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-document.pdf"

# Monitor extraction
curl http://localhost:5000/api/nam/runs/:runId/stream \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 6.3 Performance Benchmarks

```bash
# Run 10 test extractions
for i in {1..10}; do
  time curl -X POST http://localhost:5000/api/nam/upload \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -F "file=@test-document.pdf"
  sleep 5
done

# Calculate average time
# Expected: 30-40 seconds per 20-page document
```

### Step 7: Deployment

#### 7.1 Pre-Deployment Checklist

- [ ] EC2 instance running and healthy
- [ ] vLLM service enabled and started
- [ ] Model downloaded and loaded
- [ ] Health check endpoint responding
- [ ] Application code updated
- [ ] Environment variables configured
- [ ] Tests passing
- [ ] Monitoring/logging configured

#### 7.2 Gradual Rollout

**Phase 1: Canary (10% traffic)**
```bash
# Route 10% of NAM extractions to self-hosted LLM
# Keep 90% on OpenAI as fallback

# In application code:
const useSelfHosted = Math.random() < 0.10;
```

**Phase 2: 50% Traffic**
```bash
# After 1 week of monitoring
# Increase to 50% traffic
```

**Phase 3: 100% Traffic**
```bash
# After another week
# Route all traffic to self-hosted
# Keep OpenAI as emergency fallback
```

**Phase 4: Remove OpenAI**
```bash
# After 1 month of stable operation
# Remove OpenAI dependency completely
```

#### 7.3 Monitoring

**CloudWatch Metrics**:
```bash
# Create custom metrics
aws cloudwatch put-metric-data \
  --namespace NAMExtraction \
  --metric-name LLMInferenceTime \
  --value 35.2 \
  --unit Seconds

aws cloudwatch put-metric-data \
  --namespace NAMExtraction \
  --metric-name LLMAccuracy \
  --value 92.5 \
  --unit Percent
```

**Log Aggregation**:
```bash
# Forward vLLM logs to CloudWatch
sudo nano /etc/systemd/system/vllm.service

# Add:
[Service]
StandardOutput=journal
StandardError=journal

# Then:
sudo systemctl daemon-reload
sudo systemctl restart vllm

# View logs
sudo journalctl -u vllm -f
```

#### 7.4 Alerts

**Setup CloudWatch Alarms**:
```bash
# Alert if LLM service is down
aws cloudwatch put-metric-alarm \
  --alarm-name llm-service-health \
  --alarm-description "Alert if LLM service health check fails" \
  --metric-name HealthCheckStatus \
  --namespace NAMExtraction \
  --statistic Average \
  --period 300 \
  --threshold 0 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 2

# Alert if inference time > 60s
aws cloudwatch put-metric-alarm \
  --alarm-name llm-slow-inference \
  --alarm-description "Alert if LLM inference takes >60s" \
  --metric-name LLMInferenceTime \
  --namespace NAMExtraction \
  --statistic Average \
  --period 300 \
  --threshold 60 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Step 8: Optimization (Optional)

#### 8.1 Model Quantization (Reduce Memory)

```bash
# Use 4-bit quantization to reduce memory usage
# Allows running on smaller/cheaper GPUs

pip install auto-gptq

python -m vllm.entrypoints.openai.api_server \
  --model ~/models/llama-3.1-8b \
  --quantization gptq \
  --gpu-memory-utilization 0.95 \
  --max-model-len 8192
```

**Trade-offs**:
- ✅ 50% less GPU memory (8GB vs 16GB)
- ✅ Can use cheaper g4dn.2xlarge instance
- ⚠️ 5-10% slower inference
- ⚠️ 1-2% accuracy loss

#### 8.2 Continuous Batching (Increase Throughput)

```bash
# Enable continuous batching for better GPU utilization
python -m vllm.entrypoints.openai.api_server \
  --model ~/models/llama-3.1-8b \
  --max-num-seqs 8 \
  --enable-prefix-caching
```

**Benefits**:
- ✅ Process multiple requests simultaneously
- ✅ 2-3x higher throughput
- ✅ Lower per-request cost

#### 8.3 Scheduled Scaling

```bash
# Auto-start instance at 7:30 AM
# Auto-stop instance at 6:30 PM

# Create Lambda function
aws lambda create-function \
  --function-name start-llm-instance \
  --runtime python3.9 \
  --handler lambda_function.lambda_handler \
  --role arn:aws:iam::ACCOUNT:role/LambdaEC2Role \
  --zip-file fileb://lambda.zip

# Create EventBridge rules
aws events put-rule \
  --name start-llm-morning \
  --schedule-expression "cron(30 7 * * ? *)"

aws events put-rule \
  --name stop-llm-evening \
  --schedule-expression "cron(30 18 * * ? *)"
```

**Savings**: ~30% (only run during work hours)

---

## Migration Plan

### Pre-Migration (1-2 Weeks Before)

**Week -2**:
- [ ] Provision EC2 instance
- [ ] Install dependencies
- [ ] Download model
- [ ] Test vLLM server
- [ ] Run performance benchmarks
- [ ] Document baseline metrics

**Week -1**:
- [ ] Update application code
- [ ] Create LLM client abstraction
- [ ] Add health check endpoints
- [ ] Run integration tests
- [ ] Set up monitoring and alerts
- [ ] Create rollback plan

### Migration Day

**Phase 1: Deploy New Code (No Traffic)**
- [ ] Deploy updated application code
- [ ] Verify health checks pass
- [ ] Test with synthetic data
- [ ] Monitor for errors

**Phase 2: Canary (10% Traffic)**
- [ ] Route 10% traffic to self-hosted LLM
- [ ] Monitor for 2 hours
- [ ] Compare accuracy vs OpenAI
- [ ] Check error rates
- [ ] Verify no PHI leaks

**Phase 3: Gradual Rollout**
- [ ] If canary successful, increase to 25%
- [ ] Monitor for 2 hours
- [ ] Increase to 50%
- [ ] Monitor for 4 hours
- [ ] Increase to 75%
- [ ] Monitor overnight

**Phase 4: Full Migration (100% Traffic)**
- [ ] Route all traffic to self-hosted
- [ ] Keep OpenAI as emergency fallback
- [ ] Monitor closely for 1 week

### Post-Migration (1 Week After)

**Week +1**:
- [ ] Analyze metrics (accuracy, speed, errors)
- [ ] Gather user feedback
- [ ] Fine-tune configuration
- [ ] Document lessons learned

**Week +2**:
- [ ] Remove OpenAI dependency (if stable)
- [ ] Update documentation
- [ ] Conduct post-mortem
- [ ] Plan Phase 2 improvements

### Rollback Plan

**If migration fails**:

1. **Immediate rollback** (< 5 minutes):
   ```bash
   # Update environment variable
   export LLM_ENDPOINT=https://api.openai.com/v1
   export LLM_MODEL=gpt-4
   export LLM_API_KEY=sk-...

   # Restart application
   pm2 restart facnet-validator
   ```

2. **Root cause analysis**:
   - Review logs (CloudWatch, application logs)
   - Check error rates and types
   - Analyze failed extractions
   - Document issues

3. **Fix and retry**:
   - Address identified issues
   - Test in staging environment
   - Schedule new migration attempt

**Common rollback triggers**:
- Error rate > 5%
- Accuracy drops > 5%
- Inference time > 2x baseline
- Service downtime > 10 minutes
- User complaints

---

## Testing & Validation

### Pre-Production Testing

#### Test 1: Functional Testing

**Objective**: Verify self-hosted LLM produces correct NAM extractions

**Test Cases**:
1. Clean printed document (20 pages, 100 NAMs)
2. Degraded photocopy (10 pages, 50 NAMs)
3. Mixed handwritten/printed (5 pages, 20 NAMs)
4. Edge cases (malformed NAMs, OCR errors)
5. Empty document (0 NAMs)

**Success Criteria**:
- Precision ≥ 90%
- Recall ≥ 90%
- F1 Score ≥ 90%
- No crashes or errors

#### Test 2: Performance Testing

**Objective**: Verify processing time is acceptable

**Test Cases**:
1. Single-page document (1 page, 5 NAMs)
2. Standard document (20 pages, 100 NAMs)
3. Large document (50 pages, 250 NAMs)
4. Concurrent extractions (5 simultaneous)

**Success Criteria**:
- Single page: < 5 seconds
- Standard (20 pages): < 45 seconds
- Large (50 pages): < 120 seconds
- Concurrent: No degradation > 20%

#### Test 3: Load Testing

**Objective**: Verify system handles expected load

**Test Scenarios**:
1. Normal load: 10 extractions/hour
2. Peak load: 50 extractions/hour
3. Sustained load: 100 extractions over 8 hours

**Success Criteria**:
- No memory leaks (monitor GPU memory)
- Response time variance < 20%
- Error rate < 1%
- No service crashes

#### Test 4: PHI Compliance Testing

**Objective**: Verify no PHI data leaves controlled infrastructure

**Test Cases**:
1. Monitor network traffic during extraction
2. Verify data stays in VPC
3. Check logs for PHI exposure
4. Test data deletion after processing

**Success Criteria**:
- No external API calls (except Textract)
- No PHI in logs
- All temporary files deleted
- Data encrypted in transit

### Production Validation

#### Metric 1: Accuracy

**Collection**:
```typescript
// Track precision, recall, F1 for each extraction
interface ExtractionMetrics {
  runId: string;
  precision: number;  // TP / (TP + FP)
  recall: number;     // TP / (TP + FN)
  f1Score: number;    // 2 * (P * R) / (P + R)
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}
```

**Target**:
- Precision: ≥ 90%
- Recall: ≥ 90%
- F1 Score: ≥ 90%

**Alert if**:
- Precision < 85% for 3 consecutive extractions
- Recall < 85% for 3 consecutive extractions

#### Metric 2: Processing Time

**Collection**:
```typescript
interface PerformanceMetrics {
  runId: string;
  totalTimeMs: number;
  ocrTimeMs: number;
  llmTimeMs: number;
  validationTimeMs: number;
  pagesPerSecond: number;
}
```

**Target**:
- Total time: < 45s for 20-page document
- LLM time: < 30s for 20-page document

**Alert if**:
- Total time > 60s
- LLM time > 45s

#### Metric 3: Cost

**Collection**:
```typescript
interface CostMetrics {
  date: string;
  extractionCount: number;
  ec2CostUSD: number;
  textractCostUSD: number;
  totalCostUSD: number;
  costPerExtraction: number;
}
```

**Target**:
- Fixed monthly cost: ~$118
- Per-extraction cost: $0.24 (at 500/month)

**Alert if**:
- Monthly cost > $150
- Unexpected charges appear

#### Metric 4: Availability

**Collection**:
```typescript
interface AvailabilityMetrics {
  timestamp: number;
  serviceHealthy: boolean;
  responseTimeMs: number;
  errorRate: number;
}
```

**Target**:
- Uptime: > 99% during work hours (8am-6pm)
- Response time: < 100ms for health check
- Error rate: < 1%

**Alert if**:
- Health check fails 3 times in 5 minutes
- Error rate > 5%

---

## Appendix

### A. Glossary

- **LLM**: Large Language Model
- **PHI**: Protected Health Information
- **BAA**: Business Associate Agreement (HIPAA)
- **NAM**: Numéro d'Assurance Maladie (Quebec health insurance number)
- **vLLM**: Very Large Language Model (inference engine)
- **MoE**: Mixture of Experts (model architecture)
- **Quantization**: Reducing model precision to save memory
- **Inference**: Running a trained model to get predictions

### B. Troubleshooting

#### Issue: vLLM won't start

**Symptoms**:
```
CUDA out of memory error
```

**Solution**:
```bash
# Reduce GPU memory utilization
python -m vllm.entrypoints.openai.api_server \
  --model ~/models/llama-3.1-8b \
  --gpu-memory-utilization 0.7  # Reduce from 0.9

# OR reduce max sequence length
  --max-model-len 4096  # Reduce from 8192
```

#### Issue: Slow inference (> 60s)

**Symptoms**:
- Processing takes 2-3x longer than expected

**Possible Causes**:
1. GPU not being used (check `nvidia-smi`)
2. Not enough GPU memory
3. Too many concurrent requests
4. Model not loaded in VRAM

**Solutions**:
```bash
# Check GPU usage
watch -n 1 nvidia-smi

# Verify model loaded in GPU memory
# Should show ~14-16GB used

# Check vLLM logs
sudo journalctl -u vllm -f

# Restart service
sudo systemctl restart vllm
```

#### Issue: Accuracy lower than expected

**Symptoms**:
- Precision/recall < 85%
- Many false positives/negatives

**Possible Causes**:
1. Model temperature too high
2. Prompt not optimized
3. OCR quality issues
4. Model hallucinating

**Solutions**:
```typescript
// Ensure temperature = 0.0 (deterministic)
await llmClient.chatCompletion({
  messages: [...],
  temperature: 0.0  // Critical for accuracy
});

// Add more examples to prompt
// Improve OCR preprocessing
// Try different model (DeepSeek V2.5)
```

#### Issue: Out of memory during peak load

**Symptoms**:
```
CUDA out of memory: tried to allocate X GB
```

**Solutions**:
```bash
# 1. Reduce max concurrent requests
--max-num-seqs 4  # Default is 256

# 2. Reduce max sequence length
--max-model-len 4096

# 3. Use quantized model (4-bit)
--quantization gptq

# 4. Upgrade to larger GPU instance
# From g4dn.xlarge (16GB) to g4dn.2xlarge (32GB)
```

### C. Cost Calculator

**Monthly Cost Estimator**:

```python
# Instance costs (per month, 176 work hours)
g4dn_xlarge = 0.526 * 176    # $93
g4dn_2xlarge = 0.752 * 176   # $132
g5_xlarge = 1.006 * 176      # $177
p3_2xlarge = 3.06 * 176      # $539

# Storage (per month)
ebs_gp3_100gb = 20           # $20
ebs_gp3_200gb = 40           # $40

# Data transfer (negligible within VPC)
data_transfer = 5            # ~$5

# Total cost examples
llama_8b = g4dn_xlarge + ebs_gp3_100gb + data_transfer  # $118
deepseek_v25 = p3_2xlarge + ebs_gp3_200gb + data_transfer  # $584
```

### D. References

- [Llama 3.1 Model Card](https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct)
- [DeepSeek V2.5 GitHub](https://github.com/deepseek-ai/DeepSeek-V2)
- [vLLM Documentation](https://docs.vllm.ai/)
- [AWS EC2 GPU Instances](https://aws.amazon.com/ec2/instance-types/)
- [HIPAA on AWS](https://aws.amazon.com/compliance/hipaa-compliance/)
- [Quebec Privacy Laws (Loi 25)](https://www.quebec.ca/gouvernement/politiques-orientations/loi-25)

### E. Contact & Support

**Internal Support**:
- Development Team: dev@facnet.ca
- Infrastructure: ops@facnet.ca

**External Resources**:
- vLLM Discord: https://discord.gg/vllm
- AWS Support: support.aws.amazon.com

---

**Document Version**: 1.0
**Last Updated**: 2025-01-21
**Next Review**: 2025-04-21 (quarterly)
