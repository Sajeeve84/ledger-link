<?php
/**
 * User Signup Endpoint
 * POST /api/auth/signup.php
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

$input = json_decode(file_get_contents('php://input'), true);

$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$fullName = trim($input['full_name'] ?? '');
$role = $input['role'] ?? 'client';

// Validation
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 6 characters']);
    exit;
}

if (!in_array($role, ['firm', 'accountant', 'client'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid role']);
    exit;
}

try {
    $db = getDB();
    
    // Check if email already exists
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'User already registered']);
        exit;
    }
    
    // Create user
    $userId = generateUUID();
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    
    $stmt = $db->prepare("
        INSERT INTO users (id, email, password_hash, full_name, email_verified_at)
        VALUES (?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$userId, $email, $passwordHash, $fullName]);
    
    // Assign role
    $roleId = generateUUID();
    $stmt = $db->prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)");
    $stmt->execute([$roleId, $userId, $role]);
    
    // If firm role, create firm
    if ($role === 'firm') {
        $firmId = generateUUID();
        $firmName = $fullName ? "{$fullName}'s Firm" : "My Firm";
        $stmt = $db->prepare("INSERT INTO firms (id, name, owner_id) VALUES (?, ?, ?)");
        $stmt->execute([$firmId, $firmName, $userId]);
    }
    
    // Generate session token
    $token = generateJWT([
        'user_id' => $userId,
        'email' => $email,
        'role' => $role
    ]);
    
    // Store session
    $sessionId = generateUUID();
    $expiresAt = date('Y-m-d H:i:s', time() + JWT_EXPIRY);
    $stmt = $db->prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)");
    $stmt->execute([$sessionId, $userId, $token, $expiresAt]);
    
    echo json_encode([
        'user' => [
            'id' => $userId,
            'email' => $email,
            'full_name' => $fullName
        ],
        'session' => [
            'access_token' => $token,
            'expires_at' => $expiresAt
        ],
        'role' => $role
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Registration failed: ' . $e->getMessage()]);
}
