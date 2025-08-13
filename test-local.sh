#!/bin/bash

echo "Starting local test server for Story Archive Explorer..."
echo "Archive path: /Volumes/MM/AutoExport"
echo ""
echo "Server will start at: http://localhost:8000"
echo "Use index-server.html to test the new version"
echo ""

# Set environment variable for local development
export LOCAL_DEV=1

# Start PHP server
php -S localhost:8000