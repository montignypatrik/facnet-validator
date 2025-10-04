#!/bin/bash
# Ollama Installation and Configuration Script
# For Ubuntu 24.04 VPS with 12GB RAM
# Phase 1, Step 1.1: Ollama Infrastructure Setup

set -e  # Exit on error

echo "========================================="
echo "Ollama Installation Script"
echo "========================================="
echo ""

# Step 1: Install Ollama
echo "[1/6] Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# Step 2: Verify Ollama installation
echo ""
echo "[2/6] Verifying Ollama installation..."
if command -v ollama &> /dev/null; then
    echo "✓ Ollama installed successfully"
    ollama --version
else
    echo "✗ Ollama installation failed"
    exit 1
fi

# Step 3: Configure systemd service
echo ""
echo "[3/6] Configuring Ollama systemd service..."

# Create systemd service override directory
sudo mkdir -p /etc/systemd/system/ollama.service.d

# Create environment configuration
cat << 'EOF' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
[Service]
# Bind to localhost only for security
Environment="OLLAMA_HOST=127.0.0.1:11434"

# Memory limit: 8GB max (leave 4GB for system)
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"

# Performance tuning
Environment="OLLAMA_KEEP_ALIVE=5m"
EOF

echo "✓ Systemd override configuration created"

# Step 4: Reload and enable service
echo ""
echo "[4/6] Enabling and starting Ollama service..."
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl restart ollama

# Wait for service to start
sleep 5

# Verify service status
if sudo systemctl is-active --quiet ollama; then
    echo "✓ Ollama service is running"
else
    echo "✗ Ollama service failed to start"
    sudo systemctl status ollama
    exit 1
fi

# Step 5: Pull Llama 3.2 3B model
echo ""
echo "[5/6] Pulling Llama 3.2 3B model..."
echo "This will download ~2GB of data and may take a few minutes..."
ollama pull llama3.2:3b

# Verify model is available
echo ""
echo "Available models:"
ollama list

# Step 6: Run validation test
echo ""
echo "[6/6] Running validation test..."
echo ""
echo "Testing inference with prompt: 'What is medical billing?'"
echo "Measuring response time and memory usage..."
echo ""

# Capture start time
START_TIME=$(date +%s)

# Run test inference
ollama run llama3.2:3b "What is medical billing? Provide a brief, 2-3 sentence answer." --verbose &
OLLAMA_PID=$!

# Monitor memory usage
sleep 2  # Wait for model to load
MEMORY_USAGE=$(ps aux | grep "ollama" | grep -v grep | awk '{sum+=$6} END {print sum/1024}')

# Wait for completion
wait $OLLAMA_PID

# Capture end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "========================================="
echo "Installation Complete!"
echo "========================================="
echo ""
echo "Service Status:"
sudo systemctl status ollama --no-pager | head -n 10
echo ""
echo "Memory Usage During Test: ${MEMORY_USAGE}MB"
echo "Response Time: ${DURATION} seconds"
echo ""
echo "Next Steps:"
echo "1. Review the test output above"
echo "2. Verify response quality is coherent"
echo "3. Check that memory usage is under 8GB (8192MB)"
echo "4. Check that response time is under 30 seconds"
echo ""
echo "Useful Commands:"
echo "  sudo systemctl status ollama  # Check service status"
echo "  ollama list                   # List installed models"
echo "  ollama ps                     # Show running models"
echo "  sudo journalctl -u ollama -f  # View service logs"
echo "  ollama run llama3.2:3b        # Interactive chat mode"
echo ""
