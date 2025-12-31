<?php
/**
 * Send Invite Email via SMTP
 * POST /api/invites/send-email.php
 * 
 * Body: { email, inviteLink, inviteType, firmName }
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../helpers/jwt.php';
require_once __DIR__ . '/../../helpers/smtp.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Require authentication (only firm owners can send invites)
$user = requireAuth();

$input = json_decode(file_get_contents('php://input'), true);

$email = trim($input['email'] ?? '');
$inviteLink = trim($input['inviteLink'] ?? '');
$inviteType = trim($input['inviteType'] ?? 'client');
$firmName = trim($input['firmName'] ?? 'Our Firm');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid email is required']);
    exit;
}

if (empty($inviteLink)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invite link is required']);
    exit;
}

// Build the email content
$roleLabel = $inviteType === 'accountant' ? 'Accountant' : 'Client';
$subject = "You're invited to join {$firmName} on DocuFlow";

$safeFirmName = htmlspecialchars($firmName, ENT_QUOTES, 'UTF-8');
$safeLink = htmlspecialchars($inviteLink, ENT_QUOTES, 'UTF-8');
$safeRole = htmlspecialchars($roleLabel, ENT_QUOTES, 'UTF-8');

$html = <<<HTML
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #111827;">You're Invited!</h1>
  <p>You've been invited to join <strong>{$safeFirmName}</strong> as a <strong>{$safeRole}</strong> on DocuFlow.</p>
  <p>Click the button below to accept your invitation and create your account:</p>
  <p style="margin: 24px 0;">
    <a href="{$safeLink}" style="display: inline-block; padding: 14px 24px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
      Accept Invitation
    </a>
  </p>
  <p style="color: #6b7280; font-size: 14px;">This invitation link will expire in 48 hours.</p>
  <p style="color: #6b7280; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
  <p style="color: #9ca3af; font-size: 12px;">DocuFlow - Document Management Made Simple</p>
</div>
HTML;

$text = "You're Invited!\n\nYou've been invited to join {$firmName} as a {$roleLabel} on DocuFlow.\n\nAccept your invitation: {$inviteLink}\n\nThis invitation link will expire in 48 hours.\n\nIf you didn't expect this invitation, you can safely ignore this email.";

$result = smtp_send_mail($email, $subject, $html, $text);

if ($result['success']) {
    echo json_encode([
        'success' => true,
        'message' => 'Invitation email sent successfully'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to send email',
        'details' => $result['error'] ?? 'Unknown error'
    ]);
}
