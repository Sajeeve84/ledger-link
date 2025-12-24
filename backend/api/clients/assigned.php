<?php
/**
 * Get clients assigned to the current accountant
 * GET /api/clients/assigned.php
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/jwt.php';

setCorsHeaders();

$user = requireAuth();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }
    
    $accountantId = $user['user_id'];
    
    // Get all clients assigned to this accountant
    $stmt = $db->prepare("
        SELECT c.*, u.email, u.full_name, u.phone
        FROM clients c
        JOIN users u ON c.user_id = u.id
        WHERE c.assigned_accountant_id = ?
    ");
    $stmt->execute([$accountantId]);
    
    $clients = $stmt->fetchAll();
    echo json_encode(['data' => $clients]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
