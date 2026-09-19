<?php
/** Execute the real bridge with synthetic WordPress/HTTP boundaries. */
namespace CalorieApp\IdentityBridge {
    class Plugin {
        public static function get_options(): array {
            return [
                'calorieapp_backend_url' => 'https://backend.example.test',
                'bridge_secret' => 'synthetic-bridge-secret-for-tests-only',
                'backend_client_id' => 'calorieapp-backend',
                'default_callback_url' => 'https://app.example.test/auth/callback',
                'callback_allowlist' => 'https://app.example.test/auth/callback',
                'code_ttl_seconds' => 60,
            ];
        }
    }
}
namespace {
    define('ABSPATH', dirname(__DIR__, 2));
    class WP_Error {
        public function __construct(public string $code, public string $message, public array $data = []) {}
    }
    class WP_REST_Request {
        public function __construct(private array $params) {}
        public function get_param(string $key) { return $this->params[$key] ?? null; }
    }
    class WP_REST_Response {
        public function __construct(public $data, public int $status) {}
    }
    function ensure($condition, string $message): void {
        if (!$condition) { throw new \RuntimeException($message); }
    }
    function wp_json_encode($data, int $flags = 0) { return json_encode($data, $flags); }
    function wp_parse_url($url, int $part = -1) { return parse_url($url, $part); }
    function home_url($path = '') { return 'https://calorietoken.net' . $path; }
    function untrailingslashit($value) { return rtrim($value, '/'); }
    function is_wp_error($value) { return $value instanceof WP_Error; }
    function is_user_logged_in() { return $GLOBALS['current_user'] > 0; }
    function get_current_user_id() { return $GLOBALS['current_user']; }
    function get_user_meta($user, $key, $single) {
        ensure($key === 'xrpl-r-address', 'Unexpected identity metadata');
        return $user === 42 ? 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh' : '';
    }
    function add_query_arg($args, $url) { return $url . '?' . http_build_query($args); }
    function wp_remote_retrieve_response_code($response) { return $response['response']['code']; }
    function wp_remote_retrieve_body($response) { return $response['body']; }
    function fake_response($body, int $status = 200) {
        return ['response' => ['code' => $status], 'body' => is_string($body) ? $body : json_encode($body)];
    }
    function wp_remote_post($url, $args) {
        ensure($url === 'https://backend.example.test/api/identity/login/state/validate', 'Unexpected validation destination');
        return fake_response(['valid' => true, 'locale' => 'en', 'code_transport' => $GLOBALS['transport']]);
    }
    function wp_safe_remote_post($url, $args) {
        $GLOBALS['requests']++;
        ensure($url === 'https://backend.example.test/api/identity/bridge/code', 'Unexpected code destination');
        ensure($args['redirection'] === 0, 'Identity assertions must not follow redirects');
        $headers = $args['headers'];
        $body = json_decode($args['body'], true);
        ensure($body['external_subject'] === 'wp:calorietoken.net:42', 'Must assert the authenticated WordPress user');
        ensure($body['xrpl_address'] === 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', 'Must use verified user metadata');
        ensure(!isset($headers['X-CalorieApp-Bridge-Secret']), 'Shared secret must not be sent');
        $canonical = '{"version":"v2","purpose":"issue_login_code_v1",'
            . '"client_id":' . json_encode($headers['X-CalorieApp-Client-Id'])
            . ',"timestamp":' . json_encode($headers['X-CalorieApp-Timestamp'])
            . ',"nonce":' . json_encode($headers['X-CalorieApp-Nonce'])
            . ',"state":' . json_encode($body['state'])
            . ',"external_subject":' . json_encode($body['external_subject'])
            . ',"xrpl_address":' . json_encode($body['xrpl_address'])
            . ',"locale":' . json_encode($body['locale']) . '}';
        ensure(hash_equals(hash_hmac('sha256', $canonical, 'synthetic-bridge-secret-for-tests-only'), $headers['X-CalorieApp-Signature']), 'Full identity signature mismatch');
        $GLOBALS['last_signed_request'] = ['body' => $body, 'headers' => $headers];
        if ($GLOBALS['response_mode'] === 'http_error') { return new WP_Error('transport', 'Synthetic failure'); }
        if ($GLOBALS['response_mode'] === 'rejected') { return fake_response(['detail' => 'rejected'], 403); }
        if ($GLOBALS['response_mode'] === 'html') { return fake_response('<html>One moment, please...</html>'); }
        $response = [
            'code' => 'cb1.' . str_repeat('A', 43),
            'jti' => '00000000-0000-4000-8000-000000000001',
            'expires_at' => gmdate('c', time() + 59),
            'locale' => 'en',
        ];
        if ($GLOBALS['response_mode'] === 'bad_code') { $response['code'] = 'untrusted-code'; }
        if ($GLOBALS['response_mode'] === 'wrong_locale') { $response['locale'] = 'nl'; }
        if ($GLOBALS['response_mode'] === 'expired') { $response['expires_at'] = gmdate('c', time() - 1); }
        if ($GLOBALS['response_mode'] === 'long_lived') { $response['expires_at'] = gmdate('c', time() + 3600); }
        return fake_response($response);
    }

    $root = dirname(__DIR__, 2) . '/wordpress-plugins/calorieapp-identity-bridge/includes/';
    require $root . 'class-calorieapp-identity-bridge-storage.php';
    require $root . 'class-calorieapp-identity-bridge-locale-registry.php';
    require $root . 'class-calorieapp-identity-bridge-rest.php';
    class SyntheticStorage extends \CalorieApp\IdentityBridge\Storage {
        public int $legacy_codes = 0;
        public function __construct() {}
        public function cleanup_records(): void {}
        public function issue_code(int $user, string $state, string $address, int $ttl = 60): array {
            $this->legacy_codes++;
            return ['ok' => true, 'code' => str_repeat('B', 43), 'jti' => 'legacy', 'expires_at' => gmdate('c', time() + 60)];
        }
    }
    $storage = new SyntheticStorage();
    $api = new \CalorieApp\IdentityBridge\RestApi($storage);
    $current_user = 42;
    $transport = 'backend_v1';
    $response_mode = 'success';
    $requests = 0;
    $request = new WP_REST_Request(['state' => str_repeat('S', 64), 'redirect' => false, 'locale' => 'en']);
    $result = $api->authorize($request);
    ensure($result instanceof WP_REST_Response && $result->status === 200, 'Signed backend issuance must succeed');
    ensure(str_starts_with($result->data['code'], 'cb1.'), 'Must return the new opaque code');
    ensure(!str_contains(json_encode($result->data), 'synthetic-bridge-secret'), 'Browser must not receive the secret');
    ensure(!str_contains(json_encode($result->data), 'external_subject'), 'Browser must not receive identity claims');
    ensure($storage->legacy_codes === 0 && $requests === 1, 'New transport must not issue a WordPress code');

    foreach (['http_error', 'rejected', 'html', 'bad_code', 'wrong_locale', 'expired', 'long_lived'] as $response_mode) {
        $result = $api->authorize($request);
        ensure($result instanceof WP_Error && $result->code === 'code_issue_failed', 'Invalid server response must fail closed: ' . $response_mode);
        ensure($storage->legacy_codes === 0, 'Must not silently fall back after a failed signed request');
    }
    $response_mode = 'success';
    $current_user = 0;
    $before = $requests;
    ensure($api->authorize($request) instanceof WP_Error && $requests === $before, 'Unauthenticated visitors must not trigger issuance');
    $current_user = 99;
    ensure($api->authorize($request) instanceof WP_Error && $requests === $before, 'Missing wallet metadata must not trigger issuance');
    $current_user = 42;
    $foreign_callback = new WP_REST_Request(['state' => str_repeat('S', 64), 'callback_url' => 'https://attacker.example/callback', 'redirect' => false]);
    ensure($api->authorize($foreign_callback) instanceof WP_Error && $requests === $before, 'Foreign callbacks must be rejected before issuance');
    $wrong_locale = new WP_REST_Request(['state' => str_repeat('S', 64), 'locale' => 'nl', 'redirect' => false]);
    ensure($api->authorize($wrong_locale) instanceof WP_Error && $requests === $before, 'Wrong locale must be rejected before issuance');
    $transport = '';
    ensure($api->authorize($request) instanceof WP_REST_Response && $storage->legacy_codes === 1, 'An older backend must retain the legacy code flow');
    echo "WordPress backend-code boundary checks passed.\n";
}
