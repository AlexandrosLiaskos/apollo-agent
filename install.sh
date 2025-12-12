#!/bin/bash
# Apollo Agent - Quick Install Script
# Usage: curl -fsSL https://raw.githubusercontent.com/AlexandrosLiaskos/apollo-agent/master/install.sh | bash

set -e

echo "🚀 Apollo Agent - Quick Install"
echo "================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js >= 18.0.0"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Need >= 18.0.0"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✓ npm $(npm -v)"

# Check uv
if ! command -v uv &> /dev/null; then
    echo "⚠️  uv not found. Installing..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    
    if ! command -v uv &> /dev/null; then
        echo "❌ Failed to install uv. Please install manually:"
        echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi
fi
echo "✓ uv $(uv --version)"

echo ""
echo "Installing Apollo Agent..."

# Clone repository
INSTALL_DIR="${1:-$HOME/apollo-agent}"
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  Directory $INSTALL_DIR already exists"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    rm -rf "$INSTALL_DIR"
fi

git clone https://github.com/AlexandrosLiaskos/apollo-agent.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Setup environment
echo ""
echo "Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env file"
else
    echo "✓ .env already exists"
fi

echo ""
echo "================================"
echo "✅ Apollo Agent installed successfully!"
echo ""
echo "Next steps:"
echo "  1. cd $INSTALL_DIR"
echo "  2. Edit .env and add your OPENROUTER_API_KEY"
echo "     Get one from: https://openrouter.ai/keys"
echo "  3. npm start"
echo ""
echo "Documentation: https://github.com/AlexandrosLiaskos/apollo-agent"
echo ""
