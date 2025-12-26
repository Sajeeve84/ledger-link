<?php
/**
 * Internal Password Update Endpoint
 * POST /api/auth/update-password.php
 * 
 * Updates a user's password - called by Supabase edge function
 * This is an internal endpoint, not meant to be called directly by clients
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$internalKey = $input['internal_key'] ?? '';

// Validate internal key for security
$expectedKey = getenv('INTERNAL_API_KEY') ?: 'supabase-internal-update';
if ($internalKey !== $expectedKey) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

if (empty($email)) {
    http_response_code(400);
    echo json_encode(['error' => 'Email is required']);
    exit;
}

if (empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password is required']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 6 characters']);
    exit;
}

try {
    $db = getDB();
    
    // Find user by email
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }
    
    // Hash the password using PHP's password_hash
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    
    // Update user's password
    $stmt = $db->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$passwordHash, $user['id']]);
    
    // Invalidate all existing sessions for security
    $stmt = $db->prepare("DELETE FROM sessions WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Password updated successfully'
    ]);
    
} catch (Exception $e) {
    error_log("Password update error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update password']);
}
