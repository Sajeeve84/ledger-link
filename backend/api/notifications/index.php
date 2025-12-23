<?php
/**
 * Notifications API Endpoint
 * GET, POST, PUT /api/notifications/index.php
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
            $stmt = $db->prepare("
                SELECT * FROM notifications 
                WHERE user_id = ? 
                ORDER BY created_at DESC
            ");
            $stmt->execute([$user['user_id']]);
            $notifications = $stmt->fetchAll();
            
            echo json_encode(['data' => $notifications]);
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            $notifId = generateUUID();
            $stmt = $db->prepare("
                INSERT INTO notifications (id, user_id, title, message, document_id)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $notifId,
                $input['user_id'],
                $input['title'],
                $input['message'],
                $input['document_id'] ?? null
            ]);
            
            echo json_encode(['data' => ['id' => $notifId]]);
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $notifId = $_GET['id'] ?? $input['id'] ?? null;
            
            if (!$notifId) {
                http_response_code(400);
                echo json_encode(['error' => 'Notification ID required']);
                exit;
            }
            
            if (isset($input['is_read'])) {
                $stmt = $db->prepare("UPDATE notifications SET is_read = ? WHERE id = ? AND user_id = ?");
                $stmt->execute([$input['is_read'], $notifId, $user['user_id']]);
            }
            
            echo json_encode(['data' => ['id' => $notifId, 'updated' => true]]);
            break;
            
        case 'DELETE':
            $notifId = $_GET['id'] ?? null;
            
            if ($notifId) {
                $stmt = $db->prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?");
                $stmt->execute([$notifId, $user['user_id']]);
            }
            
            echo json_encode(['data' => ['deleted' => true]]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
