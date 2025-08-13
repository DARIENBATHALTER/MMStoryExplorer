<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Check if running locally
$archivePath = '/archives';
if (php_sapi_name() === 'cli-server' || isset($_SERVER['LOCAL_DEV']) || $_SERVER['SERVER_NAME'] === 'localhost') {
    $archivePath = '/Volumes/MM/AutoExport';
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list-dates':
        listDates();
        break;
    case 'list-stories':
        $date = $_GET['date'] ?? '';
        if ($date) {
            listStories($date);
        }
        break;
    case 'get-file':
        $path = $_GET['path'] ?? '';
        if ($path) {
            serveFile($path);
        }
        break;
    default:
        echo json_encode(['error' => 'Invalid action']);
}

function listDates() {
    global $archivePath;
    $dates = [];
    
    if (is_dir($archivePath)) {
        $dirs = scandir($archivePath);
        foreach ($dirs as $dir) {
            if (preg_match('/^\d{8}$/', $dir)) {
                $dates[] = $dir;
            }
        }
    }
    
    rsort($dates);
    echo json_encode($dates);
}

function listStories($date) {
    global $archivePath;
    $stories = [];
    $dateDir = "$archivePath/$date";
    
    if (!is_dir($dateDir)) {
        echo json_encode([]);
        return;
    }
    
    $users = scandir($dateDir);
    foreach ($users as $user) {
        if ($user === '.' || $user === '..' || $user === 'AccountCaptures') continue;
        
        $userDir = "$dateDir/$user";
        if (!is_dir($userDir)) continue;
        
        $files = scandir($userDir);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            
            $fullPath = "$userDir/$file";
            $relativePath = "$date/$user/$file";
            
            if (preg_match('/\.(jpg|jpeg|png|mp4)$/i', $file)) {
                $stories[] = [
                    'username' => $user,
                    'filename' => $file,
                    'path' => $relativePath,
                    'type' => preg_match('/\.mp4$/i', $file) ? 'video' : 'image',
                    'date' => $date
                ];
            }
        }
    }
    
    echo json_encode($stories);
}

function serveFile($path) {
    global $archivePath;
    $fullPath = "$archivePath/$path";
    
    if (!file_exists($fullPath)) {
        http_response_code(404);
        exit;
    }
    
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $fullPath);
    finfo_close($finfo);
    
    header("Content-Type: $mimeType");
    header("Cache-Control: public, max-age=3600");
    readfile($fullPath);
}