<?php

namespace CalorieApp\IdentityBridge;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

if (!defined('ABSPATH')) {
    exit;
}

class RestApi {
    private const REST_NAMESPACE = 'calorieapp/v1';

    private Storage $storage;

    public function __construct(Storage $storage) {
        $this->storage = $storage;
    }

    public function register_hooks(): void {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            '/authorize',
            [
                [
                    'methods' => 'GET',
                    'callback' => [$this, 'authorize'],
                    'permission_callback' => '__return_true',
                    'args' => [
                        'state' => [
                            'required' => true,
                            'type' => 'string',
                        ],
                        'callback_url' => [
                            'required' => false,
                            'type' => 'string',
                        ],
                        'redirect' => [
                            'required' => false,
                            'type' => 'boolean',
                            'default' => true,
                        ],
                        'locale' => [
                            'required' => false,
                            'type' => 'string',
                        ],
                    ],
                ],
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/exchange',
            [
                [
                    'methods' => 'POST',
                    'callback' => [$this, 'exchange'],
                    'permission_callback' => '__return_true',
                    'args' => [
                        'code' => [
                            'required' => true,
                            'type' => 'string',
                        ],
                        'state' => [
                            'required' => true,
                            'type' => 'string',
                        ],
                    ],
                ],
            ]
        );
    }

    public function authorize(WP_REST_Request $request) {
        if (!is_user_logged_in()) {
            return new WP_Error('not_authenticated', 'WordPress user is not authenticated', ['status' => 401]);
        }

        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return new WP_Error('not_authenticated', 'WordPress user is not authenticated', ['status' => 401]);
        }

        $result = $this->authorize_current_user(
            $user_id,
            trim((string) $request->get_param('state')),
            trim((string) $request->get_param('callback_url')),
            trim((string) $request->get_param('locale'))
        );

        if ($result instanceof WP_Error) {
            return $result;
        }

        if ((bool) $request->get_param('redirect')) {
            wp_redirect((string) $result['redirect_url'], 302, 'CalorieApp Identity Bridge');
            exit;
        }

        return new WP_REST_Response($result, 200);
    }

    public function authorize_current_user(
        int $user_id,
        string $state,
        string $callback_url = '',
        string $expected_locale = ''
    ) {
        $this->storage->cleanup_records();

        if ($user_id <= 0) {
            return new WP_Error('not_authenticated', 'WordPress user is not authenticated', ['status' => 401]);
        }

        if (!$this->is_valid_state($state)) {
            return new WP_Error('invalid_state', 'State must be high-entropy and URL-safe', ['status' => 400]);
        }

        $state_validation = $this->validate_state_with_backend($state);
        if ($state_validation instanceof WP_Error) {
            return $state_validation;
        }
        $state_locale = (string) $state_validation;
        if (
            $expected_locale !== ''
            && !hash_equals(LocaleRegistry::resolve($expected_locale), $state_locale)
        ) {
            return new WP_Error(
                'locale_mismatch',
                'The login state belongs to another language context.',
                ['status' => 409]
            );
        }

        $callback_url = $this->resolve_callback_url($callback_url);
        if ($callback_url instanceof WP_Error) {
            return $callback_url;
        }

        $xrpl_address = (string) get_user_meta($user_id, 'xrpl-r-address', true);
        if ($xrpl_address === '') {
            return new WP_Error('missing_xrpl_address', 'XRPL address metadata is missing', ['status' => 400]);
        }

        if (!$this->is_valid_xrpl_classic_address($xrpl_address)) {
            return new WP_Error('invalid_xrpl_address', 'XRPL address metadata format is invalid', ['status' => 400]);
        }

        $options = Plugin::get_options();
        $ttl = max(10, min(300, (int) $options['code_ttl_seconds']));

        $issued = $this->storage->issue_code($user_id, $state, $xrpl_address, $ttl);
        if (empty($issued['ok'])) {
            return new WP_Error('code_issue_failed', 'Failed to issue authorization code', ['status' => 500]);
        }

        $code = (string) $issued['code'];
        $redirect = add_query_arg(
            [
                'code' => $code,
                'state' => $state,
            ],
            $callback_url
        );

        return [
            'code' => $code,
            'state' => $state,
            'callback_url' => $callback_url,
            'redirect_url' => $redirect,
            'expires_at' => $issued['expires_at'],
            'jti' => $issued['jti'],
            'locale' => $state_locale,
        ];
    }

    public function exchange(WP_REST_Request $request) {
        $this->storage->cleanup_records();

        if (!$this->is_server_to_server_authenticated($request)) {
            return new WP_Error('forbidden', 'Server-to-server authentication failed', ['status' => 403]);
        }

        $code = trim((string) $request->get_param('code'));
        $state = trim((string) $request->get_param('state'));

        if ($code === '' || $state === '') {
            return new WP_Error('invalid_request', 'Both code and state are required', ['status' => 400]);
        }

        $result = $this->storage->consume_code($code, $state);
        if (empty($result['ok'])) {
            $error = (string) ($result['error'] ?? 'invalid_code');
            $status = $error === 'invalid_code' ? 404 : 400;
            return new WP_Error($error, 'Authorization code validation failed', ['status' => $status]);
        }

        return new WP_REST_Response($result['claims'], 200);
    }

    private function resolve_callback_url(string $requested_callback_url) {
        $options = Plugin::get_options();

        $callback_url = trim($requested_callback_url);
        if ($callback_url === '') {
            $callback_url = trim((string) $options['default_callback_url']);
        }

        if (!$this->is_allowed_callback_url($callback_url, (string) $options['callback_allowlist'])) {
            return new WP_Error('invalid_callback', 'Callback URL is not allowlisted', ['status' => 400]);
        }

        $parts = wp_parse_url($callback_url);
        if (!is_array($parts)) {
            return new WP_Error('invalid_callback', 'Callback URL is invalid', ['status' => 400]);
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $is_loopback = in_array($host, ['localhost', '127.0.0.1', '::1'], true);

        if ($scheme !== 'https' && !($scheme === 'http' && $is_loopback)) {
            return new WP_Error(
                'invalid_callback',
                'Callback URL must use HTTPS except for loopback local staging URLs',
                ['status' => 400]
            );
        }

        return $callback_url;
    }

    private function is_allowed_callback_url(string $callback_url, string $allowlist): bool {
        $allowed = preg_split('/\R+/', $allowlist);
        if (!is_array($allowed)) {
            return false;
        }

        $normalized = untrailingslashit($callback_url);

        foreach ($allowed as $line) {
            $candidate = trim((string) $line);
            if ($candidate === '') {
                continue;
            }

            if (untrailingslashit($candidate) === $normalized) {
                return true;
            }
        }

        return false;
    }

    private function is_valid_state(string $state): bool {
        if (strlen($state) < 32 || strlen($state) > 255) {
            return false;
        }

        return preg_match('/^[A-Za-z0-9\-_.~]+$/', $state) === 1;
    }

    private function is_valid_xrpl_classic_address(string $address): bool {
        return preg_match('/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/', $address) === 1;
    }

    private function is_server_to_server_authenticated(WP_REST_Request $request): bool {
        $options = Plugin::get_options();
        $configured_secret = (string) $options['bridge_secret'];

        if ($configured_secret === '') {
            return false;
        }

        $provided_secret = (string) $request->get_header('x-calorieapp-bridge-secret');
        if ($provided_secret === '') {
            return false;
        }

        $client_id = trim((string) $options['backend_client_id']);
        if ($client_id !== '') {
            $provided_client_id = trim((string) $request->get_header('x-calorieapp-client-id'));
            if ($provided_client_id === '' || !hash_equals($client_id, $provided_client_id)) {
                return false;
            }
        }

        return hash_equals($configured_secret, $provided_secret);
    }

    private function validate_state_with_backend(string $state) {
        $options = Plugin::get_options();
        $backend_url = rtrim((string) $options['calorieapp_backend_url'], '/');
        $configured_secret = (string) $options['bridge_secret'];
        $client_id = trim((string) $options['backend_client_id']);

        if ($backend_url === '' || $configured_secret === '' || $client_id === '') {
            return new WP_Error('bridge_not_configured', 'Bridge backend validation is not configured', ['status' => 500]);
        }

        $timestamp = (string) time();
        $nonce = $this->generate_nonce();
        $signature_payload = $this->build_state_validation_signature_payload(
            $client_id,
            $timestamp,
            $nonce,
            $state
        );
        $signature = hash_hmac('sha256', $signature_payload, $configured_secret);

        $response = wp_remote_post(
            $backend_url . '/api/identity/login/state/validate',
            [
                'timeout' => 8,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-CalorieApp-Client-Id' => $client_id,
                    'X-CalorieApp-Timestamp' => $timestamp,
                    'X-CalorieApp-Nonce' => $nonce,
                    'X-CalorieApp-Signature' => $signature,
                ],
                'body' => wp_json_encode(['state' => $state]),
            ]
        );

        if (is_wp_error($response)) {
            return new WP_Error('state_validation_failed', 'Could not validate login state', ['status' => 502]);
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        if ($status !== 200) {
            return new WP_Error('invalid_state', 'State is unknown, expired, or already used', ['status' => 400]);
        }

        $body = json_decode((string) wp_remote_retrieve_body($response), true);
        if (!is_array($body) || ($body['valid'] ?? null) !== true) {
            return new WP_Error('state_validation_failed', 'Backend returned an invalid state-validation response', ['status' => 502]);
        }

        $locale = isset($body['locale']) ? trim((string) $body['locale']) : 'en';
        if (!in_array($locale, LocaleRegistry::tags(), true)) {
            return new WP_Error('state_validation_failed', 'Backend returned an invalid locale context', ['status' => 502]);
        }

        return $locale;
    }

    private function build_state_validation_signature_payload(
        string $client_id,
        string $timestamp,
        string $nonce,
        string $state
    ): string {
        $values = [
            '"version":"v1"',
            '"client_id":' . wp_json_encode($client_id, JSON_UNESCAPED_UNICODE),
            '"timestamp":' . wp_json_encode($timestamp, JSON_UNESCAPED_UNICODE),
            '"nonce":' . wp_json_encode($nonce, JSON_UNESCAPED_UNICODE),
            '"state":' . wp_json_encode($state, JSON_UNESCAPED_UNICODE),
        ];

        return '{' . implode(',', $values) . '}';
    }

    private function generate_nonce(): string {
        return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    }
}
