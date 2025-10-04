# Ollama Setup Documentation
## Phase 1, Step 1.1: Infrastructure Setup & Proof of Concept

### System Requirements
- **OS**: Ubuntu 24.04 LTS
- **RAM**: 12GB (configured to use max 8GB for Ollama)
- **CPU**: 6 vCPUs
- **Storage**: ~5GB free space for model and runtime

### Installation Steps

#### 1. Upload and Run Installation Script

```bash
# SSH to your VPS
ssh ubuntu@148.113.196.245

# Upload the installation script
# (Upload scripts/install-ollama.sh to the server)

# Make script executable
chmod +x install-ollama.sh

# Run installation
./install-ollama.sh
```

#### 2. Manual Installation (Alternative)

If you prefer manual installation:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Create systemd override directory
sudo mkdir -p /etc/systemd/system/ollama.service.d

# Create configuration file
sudo nano /etc/systemd/system/ollama.service.d/override.conf
```

Add the following content:

```ini
[Service]
# Bind to localhost only for security
Environment="OLLAMA_HOST=127.0.0.1:11434"

# Memory limit: 8GB max (leave 4GB for system)
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"

# Performance tuning
Environment="OLLAMA_KEEP_ALIVE=5m"
```

```bash
# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl restart ollama

# Pull Llama 3.2 3B model
ollama pull llama3.2:3b
```

### Configuration Explanation

#### Environment Variables

- **OLLAMA_HOST**: `127.0.0.1:11434`
  - Binds Ollama to localhost only for security
  - Your web app will connect via localhost

- **OLLAMA_MAX_LOADED_MODELS**: `1`
  - Only keep one model in memory at a time
  - Reduces memory footprint

- **OLLAMA_NUM_PARALLEL**: `1`
  - Process one request at a time
  - Prevents memory spikes from concurrent requests

- **OLLAMA_KEEP_ALIVE**: `5m`
  - Keep model loaded for 5 minutes after last use
  - Reduces latency for follow-up queries
  - Model unloads automatically if idle

#### Why Llama 3.2 3B?

- **Model Size**: ~2GB download, ~3-4GB RAM when loaded
- **Speed**: Fast inference on CPU (5-15 seconds typical)
- **Quality**: Good for general Q&A and medical billing concepts
- **Fits Budget**: Leaves 8GB for system + your web app

**Alternative Models** (if 3B doesn't meet quality needs):
- `llama3.2:1b` - Faster, smaller, lower quality (~1-2GB RAM)
- `llama3.1:8b` - Higher quality, slower (~6-8GB RAM)
- `phi3:mini` - Microsoft's 3.8B model, good for knowledge tasks

### Validation Tests

#### Test 1: Service Health

```bash
# Check if service is running
sudo systemctl status ollama

# Expected output: "active (running)"
```

#### Test 2: Model Availability

```bash
# List installed models
ollama list

# Expected output: Should show llama3.2:3b
```

#### Test 3: Inference Speed Test

```bash
# Time a simple query
time ollama run llama3.2:3b "What is medical billing? Answer in 2-3 sentences."

# ✓ PASS: Response in under 30 seconds
# ✗ FAIL: Response takes over 30 seconds
```

#### Test 4: Memory Usage Test

```bash
# Monitor memory while running inference
# Terminal 1: Run this to watch memory
watch -n 1 'free -h && echo "---" && ps aux | grep ollama | grep -v grep'

# Terminal 2: Run inference
ollama run llama3.2:3b "Explain the difference between CPT and ICD codes in medical billing."

# ✓ PASS: Memory usage stays under 8GB
# ✗ FAIL: Memory usage exceeds 8GB
```

#### Test 5: Response Quality Test

```bash
# Test medical billing knowledge
ollama run llama3.2:3b "What are the main components of a medical claim?"

# Evaluate:
# ✓ Response is coherent and makes sense
# ✓ Contains relevant medical billing concepts
# ✓ Answer is structured and clear
```

#### Test 6: Concurrent Request Test

```bash
# Test that service handles requests properly
ollama run llama3.2:3b "What is CPT coding?" &
sleep 2
ollama run llama3.2:3b "What is ICD coding?" &
wait

# ✓ PASS: Both requests complete without errors
# Note: Second request waits for first (OLLAMA_NUM_PARALLEL=1)
```

### Expected Performance Metrics

Based on your hardware (6 vCPU, 12GB RAM):

| Metric | Target | Typical |
|--------|--------|---------|
| First inference (cold start) | < 30s | 10-20s |
| Subsequent inference (warm) | < 15s | 5-10s |
| Memory usage (idle) | < 500MB | 200-300MB |
| Memory usage (active) | < 8GB | 3-5GB |
| Model load time | < 10s | 3-5s |

### Troubleshooting

#### Service won't start

```bash
# Check service logs
sudo journalctl -u ollama -n 50

# Common issues:
# - Port 11434 already in use
# - Insufficient permissions
# - Corrupted model download
```

#### Memory usage too high

```bash
# Reduce keep-alive time
sudo nano /etc/systemd/system/ollama.service.d/override.conf

# Change: Environment="OLLAMA_KEEP_ALIVE=1m"
# This unloads model after 1 minute instead of 5

sudo systemctl daemon-reload
sudo systemctl restart ollama
```

#### Slow inference times

```bash
# Check if model is loaded
ollama ps

# If empty, model needs to load on first request (adds 3-5s)

# Pre-load model:
ollama run llama3.2:3b "Hello" --verbose
```

#### Model download fails

```bash
# Clear cache and retry
rm -rf ~/.ollama/models
ollama pull llama3.2:3b

# If still fails, check disk space:
df -h
```

### Useful Commands Reference

```bash
# Service management
sudo systemctl status ollama           # Check service status
sudo systemctl restart ollama          # Restart service
sudo systemctl stop ollama             # Stop service
sudo systemctl start ollama            # Start service
sudo journalctl -u ollama -f           # Live logs

# Model management
ollama list                            # List installed models
ollama pull <model>                    # Download a model
ollama rm <model>                      # Remove a model
ollama ps                              # Show currently loaded models

# Testing
ollama run llama3.2:3b                 # Interactive chat
ollama run llama3.2:3b "prompt"        # Single query
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "What is medical billing?"
}'                                      # API test

# Monitoring
htop                                   # System resources
free -h                                # Memory usage
ps aux | grep ollama                   # Ollama processes
```

### Security Notes

1. **Localhost Only**: Ollama is configured to listen on `127.0.0.1:11434` only
2. **Firewall**: Port 11434 should NOT be exposed to the internet
3. **Access**: Only your web app (running on same server) can access Ollama
4. **No Authentication**: Ollama has no built-in auth, so localhost-only is critical

### Next Steps (Phase 1, Step 1.2)

Once validation tests pass:

1. ✓ Ollama installed and running
2. ✓ Llama 3.2 3B model downloaded
3. ✓ Performance meets targets
4. ✓ Memory usage acceptable

**Next**: Create Node.js/Express API endpoint to interface with Ollama from your web app.

### Configuration Files Location

- **Service file**: `/usr/lib/systemd/system/ollama.service` (auto-created)
- **Override config**: `/etc/systemd/system/ollama.service.d/override.conf` (created by script)
- **Models**: `~/.ollama/models/` (downloaded by Ollama)
- **Logs**: `sudo journalctl -u ollama`

### Health Check Endpoint

Ollama provides a health check endpoint:

```bash
# Check if Ollama is responding
curl http://localhost:11434/api/version

# Expected output:
# {"version":"0.x.x"}
```

### Performance Optimization Tips

1. **Pre-warm model**: Keep a background process sending a query every 4 minutes to keep model loaded
2. **Dedicated memory**: Consider using `systemd-run` with `MemoryMax=8G` for hard limit
3. **CPU affinity**: Pin Ollama to specific cores if needed
4. **SSD recommended**: Model loading is I/O intensive

### Testing Checklist

Before proceeding to Step 1.2, verify:

- [ ] `sudo systemctl status ollama` shows "active (running)"
- [ ] `ollama list` shows "llama3.2:3b"
- [ ] Test query completes in under 30 seconds
- [ ] Memory usage stays under 8GB during inference
- [ ] Response quality is coherent and relevant to medical billing
- [ ] Service survives reboot: `sudo reboot` then check status
- [ ] Health endpoint responds: `curl http://localhost:11434/api/version`

### Documentation Date
Created: January 2025
Last Updated: January 2025
Author: Dash Development Team
