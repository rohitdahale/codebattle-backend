#!/bin/bash
# Quick setup script - Run this instead of docker-compose

echo "🚀 Fast Code Executor Setup"

# Build only the executor (much faster)
echo "Building lightweight executor..."
docker build -t code-executor -f Dockerfile . --quiet

# Run executor in background
echo "Starting code executor..."
docker run -d --name code-executor -p 3001:3001 --rm code-executor

# Wait for it to start
sleep 2

# Test if it's working
if curl -s http://localhost:3001/health | grep -q "ok"; then
    echo "✅ Code executor running on http://localhost:3001"
    echo "✅ Your main app can now use CODE_EXECUTOR_URL=http://localhost:3001"
else
    echo "❌ Setup failed"
fi

echo ""
echo "To stop: docker stop code-executor"
echo "To restart: ./quick-setup.sh"