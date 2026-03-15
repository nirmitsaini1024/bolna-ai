#!/bin/bash

echo "=========================================="
echo "Phase 4 TTS Integration - Quick Test"
echo "=========================================="
echo ""

echo "1. Checking environment variables..."
if [ -f .env ]; then
    echo "✓ .env file exists"
    
    if grep -q "DEEPGRAM_API_KEY=" .env && [ -n "$(grep DEEPGRAM_API_KEY= .env | cut -d'=' -f2)" ]; then
        echo "✓ DEEPGRAM_API_KEY is set"
    else
        echo "✗ DEEPGRAM_API_KEY is missing or empty"
    fi
    
    if grep -q "OPENROUTER_API_KEY=" .env && [ -n "$(grep OPENROUTER_API_KEY= .env | cut -d'=' -f2)" ]; then
        echo "✓ OPENROUTER_API_KEY is set"
    else
        echo "✗ OPENROUTER_API_KEY is missing or empty"
    fi
    
    if grep -q "TWILIO_ACCOUNT_SID=" .env && [ -n "$(grep TWILIO_ACCOUNT_SID= .env | cut -d'=' -f2)" ]; then
        echo "✓ TWILIO_ACCOUNT_SID is set"
    else
        echo "✗ TWILIO_ACCOUNT_SID is missing or empty"
    fi
else
    echo "✗ .env file not found"
fi

echo ""
echo "2. Checking build status..."
if [ -d "dist" ]; then
    echo "✓ dist/ directory exists"
else
    echo "✗ dist/ directory not found - run 'npm run build'"
fi

echo ""
echo "3. Checking TTS module..."
if [ -f "src/tts/deepgramTTS.ts" ]; then
    echo "✓ TTS module exists"
else
    echo "✗ TTS module not found"
fi

if [ -f "dist/tts/deepgramTTS.js" ]; then
    echo "✓ TTS module compiled"
else
    echo "✗ TTS module not compiled - run 'npm run build'"
fi

echo ""
echo "4. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "✓ node_modules exists"
else
    echo "✗ node_modules not found - run 'npm install'"
fi

echo ""
echo "=========================================="
echo "Quick Test Complete"
echo "=========================================="
echo ""
echo "To test the full pipeline:"
echo "1. npm run build"
echo "2. npm start"
echo "3. In another terminal: ngrok http 3000"
echo "4. Update Twilio webhook with ngrok URL"
echo "5. Call your Twilio number and speak"
echo ""
echo "Expected logs:"
echo "  [INFO] TTS client initialized"
echo "  [INFO] [TTS_START] ..."
echo "  [DEBUG] [TTS_STREAM] ..."
echo "  [INFO] [TTS_END] ..."
echo ""
