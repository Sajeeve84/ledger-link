<?php
/**
 * Forgot Password Request Endpoint
 * POST /api/auth/forgot-password.php
 *
 * Generates a password reset token, stores it, and sends a reset email via SMTP.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/smtp.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$email = trim($input['email'] ?? '');
$origin = trim($input['origin'] ?? '');

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

// Build a safe origin fallback from current request
if (!$origin || !filter_var($origin, FILTER_VALIDATE_URL)) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $origin = $scheme . '://' . $host;
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

    $resetLink = rtrim($origin, '/') . '/reset-password?token=' . urlencode($token);

    $emailSent = false;
    $emailError = null;

    $sendResult = send_password_reset_email($email, $user['full_name'] ?? null, $resetLink);
    $emailSent = (bool)($sendResult['success'] ?? false);
    $emailError = $sendResult['error'] ?? null;

    $appEnv = strtolower(getenv('APP_ENV') ?: 'development');
    $isProd = $appEnv === 'production';

    $response = [
        'success' => true,
        'message' => 'If an account with that email exists, you will receive a password reset link.',
        'email_sent' => $emailSent,
    ];

    // Dev-only helpers (never enable in production)
    if (!$isProd) {
        $response['debug_reset_link'] = $resetLink;
        $response['debug_reset_token'] = $token;
        if (!$emailSent && $emailError) {
            $response['debug_email_error'] = $emailError;
        }
        $response['expires_at'] = $expiresAt;
    }

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to process request: ' . $e->getMessage()]);
}
