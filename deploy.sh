#!/bin/bash

# Story Archive Explorer - Quick Deployment Script
# Run this script on your Ubuntu VM

echo "🚀 Starting Story Archive Explorer deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install nginx
print_status "Installing nginx..."
sudo apt install nginx -y

# Create project directory
print_status "Creating project directory..."
sudo mkdir -p /var/www/story-archive
sudo chown $USER:www-data /var/www/story-archive
sudo chmod 755 /var/www/story-archive

# Prompt for NFS mount path
echo ""
read -p "Enter the path to your NFS mount (e.g., /mnt/nfs/archive): " NFS_PATH

if [ ! -d "$NFS_PATH" ]; then
    print_warning "Directory $NFS_PATH does not exist. You'll need to create the symlink manually later."
else
    print_status "Creating symlink to archive directory..."
    sudo ln -sf "$NFS_PATH" /var/www/story-archive/archive
fi

# Create nginx configuration
print_status "Creating nginx configuration..."
sudo tee /etc/nginx/sites-available/story-archive > /dev/null <<EOF
server {
    listen 8080;
    server_name _;
    
    root /var/www/story-archive;
    index index.html;
    
    # Enable CORS for all origins (adjust as needed for security)
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept";
    
    location / {
        try_files \$uri \$uri/ =404;
    }
    
    location /archive/ {
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }
    
    # Handle archive files with proper MIME types
    location ~* \.(mp4|mov|avi|mkv)$ {
        add_header Content-Type video/mp4;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(jpg|jpeg|png|gif|webp)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
print_status "Enabling nginx site..."
sudo ln -sf /etc/nginx/sites-available/story-archive /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
print_status "Testing nginx configuration..."
if sudo nginx -t; then
    print_status "Nginx configuration is valid!"
else
    print_error "Nginx configuration is invalid. Please check the config."
    exit 1
fi

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 8080
sudo ufw allow 'Nginx Full'

# Start nginx
print_status "Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl reload nginx

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
print_status "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Copy your project files to: /var/www/story-archive/"
echo "2. Edit config.js if needed"
echo "3. Access your app at: http://$SERVER_IP:8080"
echo ""
echo "🔧 Useful commands:"
echo "- Check nginx status: sudo systemctl status nginx"
echo "- View nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "- Restart nginx: sudo systemctl restart nginx"
echo ""
print_warning "Don't forget to copy your project files to /var/www/story-archive/!"