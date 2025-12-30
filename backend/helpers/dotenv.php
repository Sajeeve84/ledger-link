<?php
/**
 * Simple .env loader for the PHP backend (no dependencies)
 *
 * Usage:
 *   require_once __DIR__ . '/dotenv.php';
 *   load_dotenv(); // loads backend/.env
 */

function load_dotenv(?string $path = null): void
{
    $path = $path ?: (dirname(__DIR__) . '/.env');

    if (!is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES);
    if (!$lines) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, ';')) {
            continue;
        }

        // Allow "export KEY=VALUE"
        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }

        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $pos));
        $val = trim(substr($line, $pos + 1));

        if ($key === '') {
            continue;
        }

        // Strip surrounding quotes
        if ((str_starts_with($val, '"') && str_ends_with($val, '"')) || (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
            $val = substr($val, 1, -1);
        }

        // Don't overwrite already-set env vars
        if (getenv($key) !== false) {
            continue;
        }

        putenv("{$key}={$val}");
        $_ENV[$key] = $val;
    }
}
