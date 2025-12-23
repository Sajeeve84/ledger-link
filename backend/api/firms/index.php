<?php
/**
 * Firms API Endpoint
 * GET, POST /api/firms/index.php
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
            // Get firm for current user (owner or accountant)
            $userId = $user['user_id'];
            
            // First check if user is a firm owner
            $stmt = $db->prepare("SELECT * FROM firms WHERE owner_id = ?");
            $stmt->execute([$userId]);
            $firm = $stmt->fetch();
            
            if (!$firm) {
                // Check if user is an accountant
                $stmt = $db->prepare("
                    SELECT f.* FROM firms f
                    JOIN firm_accountants fa ON f.id = fa.firm_id
                    WHERE fa.accountant_id = ?
                ");
                $stmt->execute([$userId]);
                $firm = $stmt->fetch();
            }
            
            echo json_encode(['data' => $firm ?: null]);
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            $firmId = generateUUID();
            $stmt = $db->prepare("
                INSERT INTO firms (id, name, owner_id, address, phone)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $firmId,
                $input['name'] ?? 'My Firm',
                $user['user_id'],
                $input['address'] ?? null,
                $input['phone'] ?? null
            ]);
            
            echo json_encode([
                'data' => [
                    'id' => $firmId,
                    'name' => $input['name'],
                    'owner_id' => $user['user_id']
                ]
            ]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
