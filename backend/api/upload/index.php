<?php
/**
 * File Upload API Endpoint
 * POST /api/upload/index.php
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/jwt.php';

setCorsHeaders();

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['file'];
$clientId = $_POST['client_id'] ?? null;

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error: ' . $file['error']]);
    exit;
}

if ($file['size'] > MAX_FILE_SIZE) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large. Maximum size is 10MB']);
    exit;
}

// Create upload directory if not exists
$uploadDir = UPLOAD_DIR . date('Y/m/');
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$newFilename = generateUUID() . '.' . $extension;
$filePath = $uploadDir . $newFilename;
$relativePath = 'uploads/' . date('Y/m/') . $newFilename;

if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit;
}

// If client_id provided, create document record
if ($clientId) {
    try {
        $db = getDB();
        $docId = generateUUID();
        $stmt = $db->prepare("
            INSERT INTO documents (id, client_id, file_name, file_path, file_type, file_size)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $docId,
            $clientId,
            $file['name'],
            $relativePath,
            $file['type'],
            $file['size']
        ]);
        
        echo json_encode([
            'data' => [
                'document_id' => $docId,
                'file_path' => $relativePath,
                'file_name' => $file['name']
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    echo json_encode([
        'data' => [
            'file_path' => $relativePath,
            'file_name' => $file['name']
        ]
    ]);
}
