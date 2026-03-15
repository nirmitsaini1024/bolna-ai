#!/bin/bash

echo "🚀 Starting Bolna Voice AI Platform with Dashboard"
echo ""

echo "📦 Installing backend dependencies..."
npm install

echo ""
echo "📦 Installing dashboard dependencies..."
cd dashboard && npm install && cd ..

echo ""
echo "🔨 Building backend..."
npm run build

echo ""
echo "🔨 Building dashboard..."
cd dashboard && npm run build && cd ..

echo ""
echo "✅ Build complete!"
echo ""
echo "To start both services:"
echo "  Terminal 1: npm start                    (Backend on port 3000)"
echo "  Terminal 2: cd dashboard && npm start    (Dashboard on port 3001)"
echo "  Terminal 3: ngrok http 3000              (Expose backend)"
echo ""
echo "Or use PM2 for production:"
echo "  pm2 start dist/server.js --name bolna-backend"
echo "  cd dashboard && pm2 start npm --name bolna-dashboard -- start"
echo ""
