<?php
/**
 * Profiles API Endpoint
 * GET, PUT /api/profiles/index.php
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/jwt.php';

setCorsHeaders();

$user = requireAuth();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            $userId = $_GET['user_id'] ?? $user['user_id'];
            
            $stmt = $db->prepare("
                SELECT id, email, full_name, phone, avatar_url, created_at, updated_at
                FROM users WHERE id = ?
            ");
            $stmt->execute([$userId]);
            $profile = $stmt->fetch();
            
            echo json_encode(['data' => $profile]);
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            
            $updates = [];
            $params = [];
            
            if (isset($input['full_name'])) {
                $updates[] = "full_name = ?";
                $params[] = $input['full_name'];
            }
            if (isset($input['phone'])) {
                $updates[] = "phone = ?";
                $params[] = $input['phone'];
            }
            if (isset($input['avatar_url'])) {
                $updates[] = "avatar_url = ?";
                $params[] = $input['avatar_url'];
            }
            
            if (count($updates) > 0) {
                $params[] = $user['user_id'];
                $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
            }
            
            echo json_encode(['data' => ['updated' => true]]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
