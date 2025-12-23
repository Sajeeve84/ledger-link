<?php
/**
 * Database Configuration
 * DocuFlow PHP Backend
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'docuflow');
define('DB_USER', 'root');
define('DB_PASSWORD', '');

// JWT Secret - CHANGE THIS IN PRODUCTION!
define('JWT_SECRET', 'your-secret-key-change-in-production-docuflow-2024');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// CORS settings
define('ALLOWED_ORIGINS', ['http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:5173']);

// Upload settings
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB

class Database {
    private static $instance = null;
    private $connection;

    private function __construct() {
        try {
            $this->connection = new PDO(
                "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
                DB_USER,
                DB_PASSWORD,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->connection;
    }
}

// Helper function to get DB connection
function getDB() {
    return Database::getInstance()->getConnection();
}
