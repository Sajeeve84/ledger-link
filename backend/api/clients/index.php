<?php
/**
 * Clients API Endpoint
 * GET, POST, PUT /api/clients/index.php
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
            $userId = $user['user_id'];
            $firmId = $_GET['firm_id'] ?? null;
            
            if ($firmId) {
                // Get all clients for a firm
                $stmt = $db->prepare("
                    SELECT c.*, u.email, u.full_name, u.phone
                    FROM clients c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.firm_id = ?
                ");
                $stmt->execute([$firmId]);
            } else {
                // Get client record for current user
                $stmt = $db->prepare("
                    SELECT c.*, u.email, u.full_name, u.phone
                    FROM clients c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.user_id = ?
                ");
                $stmt->execute([$userId]);
            }
            
            $clients = $stmt->fetchAll();
            echo json_encode(['data' => $clients]);
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            $clientId = generateUUID();
            $stmt = $db->prepare("
                INSERT INTO clients (id, user_id, firm_id, company_name, assigned_accountant_id)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $clientId,
                $input['user_id'],
                $input['firm_id'],
                $input['company_name'] ?? null,
                $input['assigned_accountant_id'] ?? null
            ]);
            
            echo json_encode(['data' => ['id' => $clientId]]);
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $clientId = $_GET['id'] ?? $input['id'] ?? null;
            
            if (!$clientId) {
                http_response_code(400);
                echo json_encode(['error' => 'Client ID required']);
                exit;
            }
            
            $updates = [];
            $params = [];
            
            if (array_key_exists('assigned_accountant_id', $input)) {
                $updates[] = "assigned_accountant_id = ?";
                $value = $input['assigned_accountant_id'];
                // Treat empty string as unassigned (NULL)
                $params[] = ($value === '' ? null : $value);
            }
            if (isset($input['company_name'])) {
                $updates[] = "company_name = ?";
                $params[] = $input['company_name'];
            }
            
            if (count($updates) > 0) {
                $params[] = $clientId;
                $sql = "UPDATE clients SET " . implode(', ', $updates) . " WHERE id = ?";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
            }
            
            echo json_encode(['data' => ['id' => $clientId, 'updated' => true]]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
