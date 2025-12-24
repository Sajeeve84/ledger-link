<?php
/**
 * CORS Headers Handler
 */

function setCorsHeaders() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // List of allowed origins
    $allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
        'http://localhost:3000',
    ];
    
    // Check if origin is allowed, or allow all in development
    if (in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: $origin");
        header("Access-Control-Allow-Credentials: true");
    } else {
        // For development, allow any origin
        header("Access-Control-Allow-Origin: *");
    }
    
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin");
    header("Access-Control-Max-Age: 86400"); // Cache preflight for 24 hours
    header("Content-Type: application/json; charset=UTF-8");
    
    // Handle preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
