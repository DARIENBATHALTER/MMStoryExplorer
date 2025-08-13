# Unraid Setup Instructions

## Step 1: Prepare NFS Mount
First, ensure your NFS share is mounted on Unraid:
```bash
# Add to /boot/config/go file:
mkdir -p /mnt/user/MM/AutoExport
mount -t nfs 192.168.4.22:/MM/AutoExport /mnt/user/MM/AutoExport
```

## Step 2: Install via Unraid Docker UI

1. Go to Docker tab in Unraid
2. Click "Add Container"
3. Configure as follows:

**Basic Settings:**
- Name: `story-explorer`
- Repository: `nginx:alpine`
- Network Type: `Bridge`

**Port Mappings:**
- Container Port: `80`
- Host Port: `8080`

**Path Mappings:**
- Container Path: `/usr/share/nginx/html`
- Host Path: `/mnt/user/appdata/story-explorer`

- Container Path: `/usr/share/nginx/html/archives`  
- Host Path: `/mnt/user/MM/AutoExport`
- Access Mode: `Read Only`

**Extra Parameters:**
```
--mount type=bind,source=/mnt/user/appdata/story-explorer/nginx.conf,target=/etc/nginx/conf.d/default.conf,readonly
```

## Step 3: Copy Files

1. Copy all app files to `/mnt/user/appdata/story-explorer/`:
```bash
# From Unraid terminal:
cd /mnt/user/appdata/
mkdir story-explorer
# Copy your files here via SMB or SCP
```

2. Ensure nginx.conf is in the directory

## Step 4: Start Container

1. Click "Apply" in Unraid Docker UI
2. The container should start automatically

## Step 5: Access the App

- Internal access: `http://192.168.4.22:8080`
- External gateway: `https://mmstoryexplorer.quiettools.dev`

## Alternative: Using Docker Compose

If you prefer command line:

```bash
# SSH into Unraid
cd /mnt/user/appdata/story-explorer
docker-compose up -d
```

## Troubleshooting

- Check logs: `docker logs story-explorer`
- Verify NFS mount: `ls -la /mnt/user/MM/AutoExport`
- Test nginx config: `docker exec story-explorer nginx -t`