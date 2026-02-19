#!/bin/bash
# Hound Database Initialization Script

# Change to the project directory
cd "$(dirname "$0")/.."

echo "Installing Go dependencies..."
go mod tidy

echo "Building Hound..."
go build -o bin/houndd ./cmds/houndd

echo ""
echo "Build completed successfully!"
echo ""
echo "To start Hound:"
echo "  ./bin/houndd --conf=config.json --addr=:6080"
echo ""
echo "Then open http://localhost:6080 in your browser."
echo ""
echo "Note: The first user you register will become the admin."
