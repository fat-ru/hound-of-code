#!/bin/bash
# Hound Build Script for Linux/MacOS

set -e

echo "========================================"
echo "Hound - Code Search Engine"
echo "========================================"

# Change to the project directory
cd "$(dirname "$0")/.."

echo ""
echo "[1/2] Installing Go dependencies..."
go mod tidy

echo ""
echo "[2/2] Building Hound..."
go build -o bin/houndd ./cmds/houndd

echo ""
echo "========================================"
echo "Build completed successfully!"
echo "========================================"
echo ""
echo "To start Hound:"
echo "  ./bin/houndd --conf=config.json --addr=:6080"
echo ""
echo "Then open http://localhost:6080 in your browser."
echo ""
echo "Note: The first user you register will become the admin."
echo ""
