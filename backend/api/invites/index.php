<?php
/**
 * Invite Tokens API Endpoint
 * GET, POST, PUT /api/invites/index.php
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/jwt.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

try {
    switch ($method) {
        case 'GET':
            $token = $_GET['token'] ?? null;
            
            if ($token) {
                // Public: validate token
                $stmt = $db->prepare("
                    SELECT it.*, f.name as firm_name, f.owner_id as firm_owner_id
                    FROM invite_tokens it
                    JOIN firms f ON it.firm_id = f.id
                    WHERE it.token = ? AND it.used_at IS NULL AND it.expires_at > NOW()
                ");
                $stmt->execute([$token]);
                $invite = $stmt->fetch();
                
                if (!$invite) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Invalid or expired invite']);
                    exit;
                }
                
                echo json_encode(['data' => $invite]);
            } else {
                // Protected: list invites for firm
                $user = requireAuth();
                
                $stmt = $db->prepare("
                    SELECT it.* FROM invite_tokens it
                    JOIN firms f ON it.firm_id = f.id
                    WHERE f.owner_id = ?
                    ORDER BY it.created_at DESC
                ");
                $stmt->execute([$user['user_id']]);
                $invites = $stmt->fetchAll();
                
                echo json_encode(['data' => $invites]);
            }
            break;
            
        case 'POST':
            $user = requireAuth();
            $input = json_decode(file_get_contents('php://input'), true);
            
            $inviteId = generateUUID();
            $token = generateUUID();
            $expiresAt = date('Y-m-d H:i:s', strtotime('+48 hours'));
            
            $stmt = $db->prepare("
                INSERT INTO invite_tokens (id, token, firm_id, email, role, created_by, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $inviteId,
                $token,
                $input['firm_id'],
                $input['email'],
                $input['role'],
                $user['user_id'],
                $expiresAt
            ]);
            
            echo json_encode([
                'data' => [
                    'id' => $inviteId,
                    'token' => $token,
                    'expires_at' => $expiresAt
                ]
            ]);
            break;
            
        case 'PUT':
            // Mark token as used
            $user = requireAuth();
            $input = json_decode(file_get_contents('php://input'), true);
            $token = $_GET['token'] ?? $input['token'] ?? null;
            
            if (!$token) {
                http_response_code(400);
                echo json_encode(['error' => 'Token required']);
                exit;
            }
            
            $stmt = $db->prepare("
                UPDATE invite_tokens SET used_at = NOW()
                WHERE token = ? AND used_at IS NULL AND expires_at > NOW()
            ");
            $stmt->execute([$token]);
            
            echo json_encode(['data' => ['used' => true]]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
