#!/usr/bin/env python3
import os
import json
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import re

# Configure archive path
ARCHIVE_PATH = '/Volumes/MM/AutoExport'
if not os.path.exists(ARCHIVE_PATH):
    ARCHIVE_PATH = '/archives'

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query_params = parse_qs(parsed_path.query)
        
        # Handle API requests
        if parsed_path.path == '/api.php' or parsed_path.path == '/api':
            action = query_params.get('action', [''])[0]
            
            if action == 'list-dates':
                self.list_dates()
            elif action == 'list-stories':
                date = query_params.get('date', [''])[0]
                if date:
                    self.list_stories(date)
                else:
                    self.send_json_response([])
            elif action == 'get-file':
                path = query_params.get('path', [''])[0]
                if path:
                    self.serve_file(path)
                else:
                    self.send_error(404)
            else:
                self.send_json_response({'error': 'Invalid action'})
        
        # Serve static files
        else:
            self.serve_static_file()
    
    def list_dates(self):
        dates = []
        if os.path.isdir(ARCHIVE_PATH):
            for dir_name in os.listdir(ARCHIVE_PATH):
                if re.match(r'^\d{8}$', dir_name):
                    dates.append(dir_name)
        dates.sort(reverse=True)
        self.send_json_response(dates)
    
    def list_stories(self, date):
        stories = []
        date_dir = os.path.join(ARCHIVE_PATH, date)
        
        if not os.path.isdir(date_dir):
            self.send_json_response([])
            return
        
        for user in os.listdir(date_dir):
            if user in ['.', '..', 'AccountCaptures']:
                continue
            
            user_dir = os.path.join(date_dir, user)
            if not os.path.isdir(user_dir):
                continue
            
            for filename in os.listdir(user_dir):
                if filename in ['.', '..']:
                    continue
                
                full_path = os.path.join(user_dir, filename)
                relative_path = f"{date}/{user}/{filename}"
                
                if re.search(r'\.(jpg|jpeg|png|mp4)$', filename, re.IGNORECASE):
                    file_type = 'video' if filename.lower().endswith('.mp4') else 'image'
                    stories.append({
                        'username': user,
                        'filename': filename,
                        'path': relative_path,
                        'type': file_type,
                        'date': date
                    })
        
        self.send_json_response(stories)
    
    def serve_file(self, path):
        full_path = os.path.join(ARCHIVE_PATH, path)
        
        if not os.path.exists(full_path):
            self.send_error(404)
            return
        
        mime_type, _ = mimetypes.guess_type(full_path)
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        self.send_response(200)
        self.send_header('Content-Type', mime_type)
        self.send_header('Cache-Control', 'public, max-age=3600')
        self.end_headers()
        
        with open(full_path, 'rb') as f:
            self.wfile.write(f.read())
    
    def serve_static_file(self):
        path = self.path[1:] if self.path.startswith('/') else self.path
        if path == '' or path == '/':
            path = 'index.html'
        
        if not os.path.exists(path):
            self.send_error(404)
            return
        
        mime_type, _ = mimetypes.guess_type(path)
        if not mime_type:
            mime_type = 'text/plain'
        
        self.send_response(200)
        self.send_header('Content-Type', mime_type)
        self.end_headers()
        
        with open(path, 'rb') as f:
            self.wfile.write(f.read())
    
    def send_json_response(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == '__main__':
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, APIHandler)
    print(f'Server running at http://localhost:8000')
    print(f'Archive path: {ARCHIVE_PATH}')
    httpd.serve_forever()