<?php
/**
 * User Logout Endpoint
 * POST /api/auth/logout.php
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/jwt.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$user = getAuthUser();

if ($user) {
    try {
        $db = getDB();
        
        // Get the token from header
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        preg_match('/Bearer\s+(.+)/', $authHeader, $matches);
        $token = $matches[1] ?? '';
        
        // Delete session
        $stmt = $db->prepare("DELETE FROM sessions WHERE token = ?");
        $stmt->execute([$token]);
        
    } catch (Exception $e) {
        // Ignore errors during logout
    }
}

echo json_encode(['message' => 'Logged out successfully']);
