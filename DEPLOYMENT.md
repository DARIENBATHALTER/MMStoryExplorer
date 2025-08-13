# Story Archive Explorer - Server Deployment Guide

## Step 1: Install Web Server Software

SSH into your Ubuntu VM and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install nginx
sudo apt install nginx -y

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check nginx status
sudo systemctl status nginx
```

## Step 2: Setup Project Directory

```bash
# Create web directory
sudo mkdir -p /var/www/story-archive
sudo chown $USER:www-data /var/www/story-archive
sudo chmod 755 /var/www/story-archive

# Create archive symlink to your NFS mount
# Replace /path/to/your/nfs/mount with your actual NFS mount path
sudo ln -s /path/to/your/nfs/mount /var/www/story-archive/archive
```

## Step 3: Copy Project Files

Transfer all files from your local project to `/var/www/story-archive/`:

```bash
# If using scp from your Mac:
scp -r /path/to/local/project/* username@vm-ip:/var/www/story-archive/

# Or copy manually if using GUI
```

## Step 4: Configure Nginx

Create nginx site configuration:

```bash
sudo nano /etc/nginx/sites-available/story-archive
```

Add this configuration:

```nginx
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
        try_files $uri $uri/ =404;
        
        # Enable directory browsing for archive folder
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
        add_header Content-Type image/jpeg;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/story-archive /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 5: Configure Firewall

```bash
# Allow nginx through firewall
sudo ufw allow 8080
sudo ufw allow 'Nginx Full'

# Check firewall status
sudo ufw status
```

## Step 6: Update Configuration

Edit `/var/www/story-archive/config.js` on the server:

```javascript
const SERVER_CONFIG = {
    ARCHIVE_PATH: '/archive',  // Points to your NFS mount symlink
    SERVER_MODE: true,         // Enables server mode
    AUTO_LOAD: true           // Auto-loads archive on page load
};
```

## Step 7: Test the Deployment

1. Open browser and go to: `http://your-vm-ip:8080`
2. The app should load automatically
3. FFmpeg should work without CORS errors
4. Share the URL with VPN users: `http://your-vm-ip:8080`

## Troubleshooting

### Check nginx logs:
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Check file permissions:
```bash
ls -la /var/www/story-archive/
ls -la /var/www/story-archive/archive/
```

### Test archive access:
```bash
# Should show your archive files
curl http://localhost:8080/archive/
```

### Restart services if needed:
```bash
sudo systemctl restart nginx
```

## Security Notes for Production

1. **Restrict CORS origins** in nginx config to your VPN network only
2. **Add authentication** if needed (nginx basic auth or more advanced)
3. **Use HTTPS** with SSL certificates for production
4. **Limit file access** to only necessary directories

## Performance Tips

1. **Enable gzip compression** in nginx for faster loading
2. **Increase nginx worker processes** for better performance
3. **Add caching headers** for static assets (already included above)

Your Story Archive Explorer should now be accessible to all VPN users at `http://your-vm-ip:8080`!