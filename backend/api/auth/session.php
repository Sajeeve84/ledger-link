<?php
/**
 * Get Current Session Endpoint
 * GET /api/auth/session.php
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/jwt.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$authUser = getAuthUser();

if (!$authUser) {
    echo json_encode(['user' => null, 'session' => null, 'role' => null]);
    exit;
}

try {
    $db = getDB();
    
    // Get full user data
    $stmt = $db->prepare("
        SELECT u.id, u.email, u.full_name, u.phone, u.avatar_url, ur.role
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        WHERE u.id = ?
    ");
    $stmt->execute([$authUser['user_id']]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo json_encode(['user' => null, 'session' => null, 'role' => null]);
        exit;
    }
    
    // Get token expiry from header
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    preg_match('/Bearer\s+(.+)/', $authHeader, $matches);
    $token = $matches[1] ?? '';
    
    echo json_encode([
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'],
            'phone' => $user['phone'],
            'avatar_url' => $user['avatar_url']
        ],
        'session' => [
            'access_token' => $token,
            'expires_at' => date('Y-m-d H:i:s', $authUser['exp'])
        ],
        'role' => $user['role']
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to get session: ' . $e->getMessage()]);
}
