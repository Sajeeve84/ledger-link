<?php
/**
 * Forgot Password Request Endpoint
 * POST /api/auth/forgot-password.php
 * 
 * Generates a password reset token and returns it
 * In production, this would send an email with the reset link
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

if (empty($email)) {
    http_response_code(400);
    echo json_encode(['error' => 'Email is required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email format']);
    exit;
}

try {
    $db = getDB();
    
    // Check if user exists
    $stmt = $db->prepare("SELECT id, email, full_name FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    // Always return success to prevent email enumeration
    if (!$user) {
        echo json_encode([
            'success' => true,
            'message' => 'If an account with that email exists, you will receive a password reset link.'
        ]);
        exit;
    }
    
    // Delete any existing reset tokens for this user
    $stmt = $db->prepare("DELETE FROM password_reset_tokens WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    
    // Generate reset token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', time() + 3600); // 1 hour expiry
    
    // Store token
    $stmt = $db->prepare("
        INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
        VALUES (UUID(), ?, ?, ?)
    ");
    $stmt->execute([$user['id'], $token, $expiresAt]);

    // In a production environment, you would send an email here
    // For now, we return the token (for development/testing)
    // The frontend can construct the reset URL
    
    echo json_encode([
        'success' => true,
        'message' => 'If an account with that email exists, you will receive a password reset link.',
        // Only include token in development - remove in production
        'reset_token' => $token,
        'expires_at' => $expiresAt
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to process request: ' . $e->getMessage()]);
}
