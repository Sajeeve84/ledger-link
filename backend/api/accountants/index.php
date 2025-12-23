<?php
/**
 * Accountants API Endpoint
 * GET, POST /api/accountants/index.php
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
            $firmId = $_GET['firm_id'] ?? null;
            
            if (!$firmId) {
                http_response_code(400);
                echo json_encode(['error' => 'firm_id required']);
                exit;
            }
            
            $stmt = $db->prepare("
                SELECT fa.*, u.email, u.full_name, u.phone, u.avatar_url
                FROM firm_accountants fa
                JOIN users u ON fa.accountant_id = u.id
                WHERE fa.firm_id = ?
            ");
            $stmt->execute([$firmId]);
            $accountants = $stmt->fetchAll();
            
            echo json_encode(['data' => $accountants]);
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            $id = generateUUID();
            $stmt = $db->prepare("
                INSERT INTO firm_accountants (id, firm_id, accountant_id)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([
                $id,
                $input['firm_id'],
                $input['accountant_id']
            ]);
            
            echo json_encode(['data' => ['id' => $id]]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
