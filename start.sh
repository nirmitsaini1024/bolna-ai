#!/bin/bash

# Voice AI Platform - Phase 3 Startup Script
# Ensures all environment variables are loaded correctly

cd "$(dirname "$0")"

echo "🚀 Starting Voice AI Platform - Phase 3"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure your API keys"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

echo "✅ Environment variables loaded"
echo ""

# Verify critical API keys
if [ -z "$DEEPGRAM_API_KEY" ]; then
    echo "⚠️  Warning: DEEPGRAM_API_KEY not set"
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "⚠️  Warning: OPENROUTER_API_KEY not set"
fi

if [ -z "$TWILIO_ACCOUNT_SID" ]; then
    echo "⚠️  Warning: TWILIO_ACCOUNT_SID not set"
fi

echo "📊 Configuration:"
echo "   PORT: ${PORT:-3000}"
echo "   NGROK_URL: ${NGROK_URL:0:50}..."
echo "   DEEPGRAM_API_KEY: ${DEEPGRAM_API_KEY:0:10}..."
echo "   OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:0:15}..."
echo ""

# Build if dist doesn't exist
if [ ! -d "dist" ]; then
    echo "🔨 Building project..."
    npm run build
    echo ""
fi

echo "🎯 Starting server..."
echo ""

# Start the server with environment variables
npm start
