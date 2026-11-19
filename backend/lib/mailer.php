<?php
declare(strict_types=1);

function moniSmtpRead($socket, int $expected): void
{
    $line = fgets($socket);
    if ($line === false || (int) substr($line, 0, 3) !== $expected) {
        throw new RuntimeException('SMTP command rejected.');
    }
    while (isset($line[3]) && $line[3] === '-') {
        $line = fgets($socket);
        if ($line === false) throw new RuntimeException('SMTP response incomplete.');
    }
}

function moniSmtpWrite($socket, string $command, int $expected): void
{
    fwrite($socket, $command . "\r\n");
    moniSmtpRead($socket, $expected);
}

function moniSendPasswordResetEmail(string $email, string $name, string $token): void
{
    $host = moniEnv('MONI_SMTP_HOST');
    if ($host === '') throw new RuntimeException('SMTP is not configured.');
    $port = (int) moniEnv('MONI_SMTP_PORT', '1025');
    $encryption = strtolower(moniEnv('MONI_SMTP_ENCRYPTION', 'none'));
    if (!in_array($encryption, ['none', 'tls', 'ssl'], true)) throw new RuntimeException('SMTP encryption mode is invalid.');
    $target = $encryption === 'ssl' ? 'ssl://' . $host . ':' . $port : $host . ':' . $port;
    $context = stream_context_create(['ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'allow_self_signed' => false,
        'peer_name' => $host,
        'crypto_method' => STREAM_CRYPTO_METHOD_TLS_CLIENT,
    ]]);
    $socket = @stream_socket_client($target, $errorNumber, $errorMessage, 10, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) throw new RuntimeException('SMTP connection failed.');
    stream_set_timeout($socket, 10);
    try {
        moniSmtpRead($socket, 220);
        $hostname = parse_url(moniEnv('MONI_RESET_URL', 'http://127.0.0.1'), PHP_URL_HOST) ?: 'localhost';
        moniSmtpWrite($socket, 'EHLO ' . $hostname, 250);
        if ($encryption === 'tls') {
            moniSmtpWrite($socket, 'STARTTLS', 220);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('SMTP TLS failed.');
            moniSmtpWrite($socket, 'EHLO ' . $hostname, 250);
        }
        $user = moniEnv('MONI_SMTP_USER');
        $password = moniEnv('MONI_SMTP_PASSWORD');
        if ($user !== '' && $password === '') {
            $passwordFile = moniEnv('MONI_SMTP_PASSWORD_FILE');
            if ($passwordFile !== '') {
                $password = trim((string) @file_get_contents($passwordFile));
            }
        }
        if ($user !== '') {
            if ($password === '') throw new RuntimeException('SMTP authentication is not configured.');
            moniSmtpWrite($socket, 'AUTH LOGIN', 334);
            moniSmtpWrite($socket, base64_encode($user), 334);
            moniSmtpWrite($socket, base64_encode($password), 235);
        }
        $from = moniEnv('MONI_SMTP_FROM', 'no-reply@moni.local');
        $safeName = trim(preg_replace('/[\r\n]+/', ' ', $name) ?: '');
        $resetUrl = rtrim(moniEnv('MONI_RESET_URL', 'http://127.0.0.1:4173/#reset-password'), '&?') . (str_contains(moniEnv('MONI_RESET_URL', ''), '?') ? '&' : '?') . 'token=' . rawurlencode($token);
        $subject = 'Réinitialisation de ton mot de passe Moni';
        $body = "Bonjour {$safeName},\r\n\r\nUtilise ce lien dans les 60 minutes pour choisir un nouveau mot de passe :\r\n{$resetUrl}\r\n\r\nSi tu n'es pas à l'origine de cette demande, ignore cet e-mail.\r\n";
        moniSmtpWrite($socket, 'MAIL FROM:<' . $from . '>', 250);
        moniSmtpWrite($socket, 'RCPT TO:<' . $email . '>', 250);
        moniSmtpWrite($socket, 'DATA', 354);
        $headers = 'From: Moni <' . $from . ">\r\n" . 'To: <' . $email . ">\r\n" . 'Subject: ' . $subject . "\r\n" . 'Content-Type: text/plain; charset=UTF-8';
        fwrite($socket, $headers . "\r\n\r\n" . $body . "\r\n.\r\n");
        moniSmtpRead($socket, 250);
        moniSmtpWrite($socket, 'QUIT', 221);
    } finally {
        fclose($socket);
    }
}
