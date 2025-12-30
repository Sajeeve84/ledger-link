<?php
/**
 * Minimal SMTP mailer (no external dependencies)
 *
 * Supports loading SMTP credentials from backend/.env (see helpers/dotenv.php)
 *
 * Required environment variables:
 * - SMTP_HOST
 * - SMTP_PORT (usually 587 for STARTTLS or 465 for implicit TLS)
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_FROM (e.g. "DocuFlow <no-reply@yourdomain.com>")
 *
 * Optional:
 * - SMTP_SECURE: "starttls" | "tls" | "ssl" (auto-detected if omitted)
 */

require_once __DIR__ . '/dotenv.php';
load_dotenv();

function smtp_send_mail(string $to, string $subject, string $htmlBody, ?string $textBody = null, ?string $from = null): array
{
    $host = getenv('SMTP_HOST') ?: '';
    $port = (int)(getenv('SMTP_PORT') ?: 0);
    $user = getenv('SMTP_USER') ?: '';
    $pass = getenv('SMTP_PASS') ?: '';
    $from = $from ?: (getenv('SMTP_FROM') ?: 'no-reply@localhost');

    if (!$host || !$port || !$user || !$pass) {
        return ['success' => false, 'error' => 'SMTP is not configured (missing SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS).'];
    }

    $secure = strtolower(getenv('SMTP_SECURE') ?: '');
    if (!$secure) {
        // Sensible defaults
        $secure = ($port === 465) ? 'ssl' : 'starttls';
    }

    $address = ($secure === 'ssl') ? "ssl://{$host}:{$port}" : "{$host}:{$port}";
    $fp = @stream_socket_client($address, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);

    if (!$fp) {
        return ['success' => false, 'error' => "SMTP connect failed: {$errstr} ({$errno})"]; 
    }

    stream_set_timeout($fp, 15);

    $read = function () use ($fp): string {
        $data = '';
        while (!feof($fp)) {
            $line = fgets($fp, 515);
            if ($line === false) break;
            $data .= $line;
            // Multi-line replies have hyphen after status code, final has space.
            if (preg_match('/^\d{3}\s/', $line)) break;
        }
        return $data;
    };

    $send = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };

    $expect = function (array $okPrefixes, string $context) use ($read): ?string {
        $resp = $read();
        foreach ($okPrefixes as $p) {
            if (str_starts_with($resp, $p)) return null;
        }
        return $context . ': ' . trim($resp);
    };

    // Server greeting
    $err = $expect(['220'], 'SMTP greeting');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    $send('EHLO localhost');
    $err = $expect(['250'], 'EHLO failed');
    if ($err) {
        // Fallback to HELO
        $send('HELO localhost');
        $err = $expect(['250'], 'HELO failed');
        if ($err) {
            fclose($fp);
            return ['success' => false, 'error' => $err];
        }
    }

    if ($secure === 'starttls' || $secure === 'tls') {
        $send('STARTTLS');
        $err = $expect(['220'], 'STARTTLS failed');
        if ($err) {
            fclose($fp);
            return ['success' => false, 'error' => $err];
        }

        $cryptoOk = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        if ($cryptoOk !== true) {
            fclose($fp);
            return ['success' => false, 'error' => 'TLS negotiation failed'];
        }

        $send('EHLO localhost');
        $err = $expect(['250'], 'EHLO after STARTTLS failed');
        if ($err) {
            fclose($fp);
            return ['success' => false, 'error' => $err];
        }
    }

    // AUTH LOGIN
    $send('AUTH LOGIN');
    $err = $expect(['334'], 'AUTH LOGIN not accepted');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    $send(base64_encode($user));
    $err = $expect(['334'], 'SMTP username rejected');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    $send(base64_encode($pass));
    $err = $expect(['235'], 'SMTP password rejected');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    // Extract email from "Name <email@domain>" if needed
    $fromEmail = $from;
    if (preg_match('/<([^>]+)>/', $from, $m)) {
        $fromEmail = $m[1];
    }

    $send('MAIL FROM:<' . $fromEmail . '>');
    $err = $expect(['250'], 'MAIL FROM failed');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    $send('RCPT TO:<' . $to . '>');
    $err = $expect(['250', '251'], 'RCPT TO failed');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    $send('DATA');
    $err = $expect(['354'], 'DATA command failed');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    $boundary = 'b_' . bin2hex(random_bytes(12));
    $textBody = $textBody ?: strip_tags($htmlBody);

    $headers = [];
    $headers[] = 'From: ' . $from;
    $headers[] = 'To: ' . $to;
    $headers[] = 'Subject: ' . $subject;
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';

    $message = implode("\r\n", $headers) . "\r\n\r\n";
    $message .= '--' . $boundary . "\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= $textBody . "\r\n\r\n";

    $message .= '--' . $boundary . "\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= $htmlBody . "\r\n\r\n";

    $message .= '--' . $boundary . '--' . "\r\n";

    // Dot-stuffing per RFC
    $message = preg_replace('/\r\n\./', "\r\n..", $message);

    fwrite($fp, $message . "\r\n.\r\n");
    $err = $expect(['250'], 'Message body rejected');
    if ($err) {
        fclose($fp);
        return ['success' => false, 'error' => $err];
    }

    $send('QUIT');
    $read();
    fclose($fp);

    return ['success' => true, 'error' => null];
}

function send_password_reset_email(string $to, ?string $userName, string $resetLink): array
{
    $safeName = $userName ? htmlspecialchars($userName, ENT_QUOTES, 'UTF-8') : 'there';
    $safeLink = htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8');

    $subject = 'Reset your DocuFlow password';
    $text = "Hello {$safeName},\n\nUse this link to reset your password:\n{$resetLink}\n\nIf you didn't request this, you can ignore this email.";
    $html = "<p>Hello {$safeName},</p>\n<p>Use the button below to reset your password:</p>\n<p><a href=\"{$safeLink}\" style=\"display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px\">Reset Password</a></p>\n<p style=\"color:#6b7280\">If you didn't request this, you can ignore this email.</p>";

    return smtp_send_mail($to, $subject, $html, $text);
}
