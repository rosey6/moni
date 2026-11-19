<?php
declare(strict_types=1);

$autoload = getenv('MONI_COMPOSER_AUTOLOAD') ?: dirname(__DIR__) . '/vendor/autoload.php';
if (!is_file($autoload)) throw new RuntimeException('Composer dependencies are unavailable.');
require_once $autoload;

/** PSR-18 client pins every HTTPS request to a public IP and never follows redirects. */
final class MoniSecurePushHttpClient implements Psr\Http\Client\ClientInterface
{
    public function __construct(private readonly ?Closure $resolver = null) {}

    public function sendRequest(Psr\Http\Message\RequestInterface $request): Psr\Http\Message\ResponseInterface
    {
        $endpoint = moniValidatePushEndpoint((string) $request->getUri());
        $address = moniResolvePublicPushAddress($endpoint['host'], $this->resolver);
        $handle = curl_init((string) $request->getUri());
        if ($handle === false) throw new Http\Client\Exception\RequestException('Unable to create push request.', $request);

        $headers = [];
        foreach ($request->getHeaders() as $name => $values) foreach ($values as $value) $headers[] = $name . ': ' . $value;
        $responseHeaders = [];
        $responseBody = '';
        $resolveAddress = str_contains($address, ':') ? "[{$address}]" : $address;
        curl_setopt_array($handle, [
            CURLOPT_RESOLVE => [$endpoint['host'] . ':443:' . $resolveAddress],
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => $request->getMethod(),
            CURLOPT_POSTFIELDS => (string) $request->getBody(),
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXREDIRS => 0,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_NOPROXY => '*',
            CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$responseHeaders): int {
                $length = strlen($line);
                if (str_contains($line, ':')) {
                    [$name, $value] = explode(':', $line, 2);
                    $responseHeaders[trim($name)][] = trim($value);
                }
                return $length;
            },
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$responseBody): int {
                if (strlen($responseBody) + strlen($chunk) > 65536) return 0;
                $responseBody .= $chunk;
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($handle);
        $error = curl_errno($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        if ($ok === false) throw new Http\Client\Exception\NetworkException('Push provider request failed (curl ' . $error . ').', $request);

        $factory = new Nyholm\Psr7\Factory\Psr17Factory();
        $response = $factory->createResponse($status);
        foreach ($responseHeaders as $name => $values) $response = $response->withHeader($name, $values);
        return $response->withBody($factory->createStream($responseBody));
    }
}
