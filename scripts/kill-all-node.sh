#!/bin/bash
# Emergency cleanup script - kills ALL Node.js processes
# USE WITH CAUTION: This will terminate all Node.js processes on your system

echo "⚠️  WARNING: This will kill ALL Node.js processes!"
echo "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  # Windows
  echo "Killing all Node.js processes on Windows..."
  taskkill //F //IM node.exe 2>/dev/null || echo "No Node.js processes found"
  taskkill //F //IM nodemon.exe 2>/dev/null || echo "No nodemon processes found"
else
  # Unix-like (Linux/Mac)
  echo "Killing all Node.js processes on Unix..."
  pkill -9 node 2>/dev/null || echo "No Node.js processes found"
  pkill -9 nodemon 2>/dev/null || echo "No nodemon processes found"
fi

echo "✅ All Node.js processes terminated"
