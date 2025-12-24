<?php
/**
 * Get documents for clients assigned to the current accountant
 * GET /api/documents/assigned.php
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
    
    // Get all documents for clients assigned to this accountant
    $stmt = $db->prepare("
        SELECT d.*, c.company_name, c.user_id as client_user_id, u.full_name as client_name, u.email as client_email
        FROM documents d
        JOIN clients c ON d.client_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE c.assigned_accountant_id = ?
        ORDER BY d.uploaded_at DESC
    ");
    $stmt->execute([$accountantId]);
    
    $documents = $stmt->fetchAll();
    echo json_encode(['data' => $documents]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
