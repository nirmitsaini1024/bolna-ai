#!/bin/bash

# Phase 5 Barge-In Quick Test Script

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Voice AI Platform - Phase 5 Barge-In Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo ""
    echo "Please create .env file with:"
    echo "  - DEEPGRAM_API_KEY"
    echo "  - OPENROUTER_API_KEY"
    echo "  - TWILIO_ACCOUNT_SID"
    echo "  - TWILIO_AUTH_TOKEN"
    echo "  - NGROK_URL"
    echo ""
    exit 1
fi

# Source environment variables
source .env

# Check required variables
MISSING=""
[ -z "$DEEPGRAM_API_KEY" ] && MISSING="$MISSING DEEPGRAM_API_KEY"
[ -z "$OPENROUTER_API_KEY" ] && MISSING="$MISSING OPENROUTER_API_KEY"
[ -z "$TWILIO_ACCOUNT_SID" ] && MISSING="$MISSING TWILIO_ACCOUNT_SID"
[ -z "$TWILIO_AUTH_TOKEN" ] && MISSING="$MISSING TWILIO_AUTH_TOKEN"

if [ ! -z "$MISSING" ]; then
    echo "❌ Missing required environment variables:"
    echo "$MISSING"
    echo ""
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Build project
echo "📦 Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"
echo ""

# Create logs directory
mkdir -p logs

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Server Starting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Testing Phase 5 Barge-In Support"
echo ""
echo "How to test:"
echo "  1. Call your Twilio number"
echo "  2. Wait for AI to start speaking"
echo "  3. Interrupt by speaking while AI is talking"
echo "  4. AI should stop immediately (< 500ms)"
echo ""
echo "Look for these logs:"
echo "  [TTS_START]     - AI begins speaking"
echo "  [BARGE_IN]      - You interrupted"
echo "  [TTS_ABORTED]   - TTS stopped"
echo "  [TRANSCRIPT]    - Your new words"
echo ""
echo "Press Ctrl+C to stop server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start server
npm start
