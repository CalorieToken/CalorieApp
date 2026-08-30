<?php

use CalorieApp\IdentityBridge\Plugin;
use CalorieApp\IdentityBridge\Storage;

class Test_CalorieApp_Identity_Bridge_REST extends WP_UnitTestCase {
    private Storage $storage;
    private array $last_state_validation_headers = [];

    public function setUp(): void {
        parent::setUp();

        $this->storage = new Storage();
        $this->storage->create_table();

        update_option(
            Plugin::OPTION_KEY,
            [
                'callback_allowlist' => "https://app.calorietoken.net/auth/callback\nhttps://app.calorietoken.net/callback",
                'default_callback_url' => 'https://app.calorietoken.net/auth/callback',
                'calorieapp_backend_url' => 'https://app.calorietoken.net',
                'bridge_secret' => 'test-bridge-secret-123456',
                'backend_client_id' => 'calorieapp-backend',
                'code_ttl_seconds' => 60,
            ],
            false
        );

        add_filter('pre_http_request', [$this, 'mock_backend_state_validation'], 10, 3);
    }

    public function tearDown(): void {
        global $wpdb;
        $wpdb->query('TRUNCATE TABLE ' . $wpdb->prefix . 'calorieapp_auth_codes');
        wp_set_current_user(0);
        remove_filter('pre_http_request', [$this, 'mock_backend_state_validation'], 10);
        parent::tearDown();
    }

    public function mock_backend_state_validation($preempt, array $request, string $url) {
        if (strpos($url, '/api/identity/login/state/validate') === false) {
            return $preempt;
        }

        $body = isset($request['body']) ? json_decode((string) $request['body'], true) : [];
        $state = is_array($body) ? (string) ($body['state'] ?? '') : '';
        $headers = array_change_key_case((array) ($request['headers'] ?? []), CASE_LOWER);
        $this->last_state_validation_headers = $headers;

        $client_id = (string) ($headers['x-calorieapp-client-id'] ?? '');
        $timestamp = (string) ($headers['x-calorieapp-timestamp'] ?? '');
        $nonce = (string) ($headers['x-calorieapp-nonce'] ?? '');
        $signature = (string) ($headers['x-calorieapp-signature'] ?? '');
        $payload = '{'
            . '"version":"v1",'
            . '"client_id":' . wp_json_encode($client_id, JSON_UNESCAPED_UNICODE) . ','
            . '"timestamp":' . wp_json_encode($timestamp, JSON_UNESCAPED_UNICODE) . ','
            . '"nonce":' . wp_json_encode($nonce, JSON_UNESCAPED_UNICODE) . ','
            . '"state":' . wp_json_encode($state, JSON_UNESCAPED_UNICODE)
            . '}';
        $expected_signature = hash_hmac('sha256', $payload, 'test-bridge-secret-123456');

        if (
            $client_id !== 'calorieapp-backend'
            || preg_match('/^\d{10}$/', $timestamp) !== 1
            || preg_match('/^[A-Za-z0-9_-]{20,128}$/', $nonce) !== 1
            || !hash_equals($expected_signature, $signature)
        ) {
            return [
                'headers' => [],
                'body' => wp_json_encode(['detail' => 'Bridge authentication failed']),
                'response' => ['code' => 403, 'message' => 'Forbidden'],
                'cookies' => [],
                'filename' => null,
            ];
        }

        if (strpos($state, 'invalid-') === 0) {
            return [
                'headers' => [],
                'body' => wp_json_encode(['detail' => 'Unknown login state']),
                'response' => ['code' => 400, 'message' => 'Bad Request'],
                'cookies' => [],
                'filename' => null,
            ];
        }

        return [
            'headers' => [],
            'body' => wp_json_encode(['valid' => true, 'locale' => 'en']),
            'response' => ['code' => 200, 'message' => 'OK'],
            'cookies' => [],
            'filename' => null,
        ];
    }

    public function test_unauthenticated_authorization_request_rejected(): void {
        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(401, $response->get_status());
    }

    public function test_authenticated_wordpress_user_accepted(): void {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertSame('en', $response->get_data()['locale']);
    }

    public function test_expected_locale_mismatch_is_rejected(): void {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);
        $request->set_param('locale', 'nl');

        $response = rest_do_request($request);
        $this->assertSame(409, $response->get_status());
        $this->assertSame('locale_mismatch', $response->get_data()['code']);
    }

    public function test_state_validation_uses_signed_headers_without_transmitting_secret(): void {
        $this->issue_code_response();

        $this->assertArrayHasKey('x-calorieapp-timestamp', $this->last_state_validation_headers);
        $this->assertArrayHasKey('x-calorieapp-nonce', $this->last_state_validation_headers);
        $this->assertArrayHasKey('x-calorieapp-signature', $this->last_state_validation_headers);
        $this->assertArrayNotHasKey('x-calorieapp-bridge-secret', $this->last_state_validation_headers);
    }

    public function test_xrpl_address_retrieved_from_expected_user_meta_key(): void {
        global $wpdb;

        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        $address = $this->valid_xrpl();
        update_user_meta($user_id, 'xrpl-r-address', $address);

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $row = $wpdb->get_row($wpdb->prepare('SELECT xrpl_address FROM ' . $wpdb->prefix . 'calorieapp_auth_codes WHERE wp_user_id = %d ORDER BY created_at DESC LIMIT 1', $user_id), ARRAY_A);
        $this->assertNotEmpty($row);
        $this->assertSame($address, $row['xrpl_address']);
    }

    public function test_missing_xrpl_address_rejected(): void {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(400, $response->get_status());
    }

    public function test_invalid_xrpl_address_rejected(): void {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', 'not-a-valid-address');

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(400, $response->get_status());
    }

    public function test_unknown_state_rejected_by_backend_validation(): void {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', 'invalid-' . wp_generate_password(64, false, false));
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(400, $response->get_status());
    }

    public function test_authorization_code_generated(): void {
        $response = $this->issue_code_response();
        $data = $response->get_data();
        $this->assertArrayHasKey('code', $data);
        $this->assertNotEmpty($data['code']);
    }

    public function test_code_has_high_entropy_shape(): void {
        $response = $this->issue_code_response();
        $code = (string) $response->get_data()['code'];

        $this->assertGreaterThanOrEqual(40, strlen($code));
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9\-_]+$/', $code);
    }

    public function test_code_expires_and_expired_code_rejected(): void {
        $response = $this->issue_code_response();
        $data = $response->get_data();

        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'calorieapp_auth_codes',
            ['expires_at' => gmdate('Y-m-d H:i:s', time() - 10)],
            ['id' => $data['jti']],
            ['%s'],
            ['%s']
        );

        $exchange = $this->exchange_request((string) $data['code'], (string) $data['state']);
        $this->assertSame(400, $exchange->get_status());
        $this->assertSame('expired', $exchange->get_data()['code']);
    }

    public function test_used_code_rejected_and_cannot_be_reused(): void {
        $response = $this->issue_code_response();
        $data = $response->get_data();

        $first = $this->exchange_request((string) $data['code'], (string) $data['state']);
        $this->assertSame(200, $first->get_status());

        $second = $this->exchange_request((string) $data['code'], (string) $data['state']);
        $this->assertSame(400, $second->get_status());
        $this->assertSame('already_used', $second->get_data()['code']);
    }

    public function test_wrong_state_rejected(): void {
        $response = $this->issue_code_response();
        $data = $response->get_data();

        $exchange = $this->exchange_request((string) $data['code'], 'wrong-state-value-that-is-long-enough-0123456789');
        $this->assertSame(400, $exchange->get_status());
        $this->assertSame('state_mismatch', $exchange->get_data()['code']);
    }

    public function test_arbitrary_redirect_rejected(): void {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('callback_url', 'https://evil.example/callback');
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(400, $response->get_status());
    }

    public function test_allowlisted_loopback_callback_accepted_for_local_staging(): void {
        update_option(
            Plugin::OPTION_KEY,
            [
                'callback_allowlist' => "http://localhost:3000/auth/callback",
                'default_callback_url' => 'http://localhost:3000/auth/callback',
                'calorieapp_backend_url' => 'http://127.0.0.1:8000',
                'bridge_secret' => 'test-bridge-secret-123456',
                'backend_client_id' => 'calorieapp-backend',
                'code_ttl_seconds' => 60,
            ],
            false
        );

        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertStringStartsWith(
            'http://localhost:3000/auth/callback',
            (string) $response->get_data()['redirect_url']
        );
    }

    public function test_authorize_current_user_core_does_not_depend_on_rest_cookie_authentication(): void {
        $user_id = $this->factory()->user->create();
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $rest = new \CalorieApp\IdentityBridge\RestApi($this->storage);
        $result = $rest->authorize_current_user($user_id, $this->state());

        $this->assertIsArray($result);
        $this->assertArrayHasKey('redirect_url', $result);
    }

    public function test_allowlisted_callback_accepted(): void {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('callback_url', 'https://app.calorietoken.net/callback');
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());

        $data = $response->get_data();
        $this->assertStringStartsWith('https://app.calorietoken.net/callback', (string) $data['redirect_url']);
    }

    public function test_bridge_secret_never_returned_to_browser(): void {
        $response = $this->issue_code_response();
        $data = $response->get_data();
        $encoded = wp_json_encode($data);

        $this->assertIsString($encoded);
        $this->assertStringNotContainsString('test-bridge-secret-123456', $encoded);
    }

    public function test_exchange_requires_server_to_server_authentication(): void {
        $response = $this->issue_code_response();
        $data = $response->get_data();

        $request = new WP_REST_Request('POST', '/calorieapp/v1/exchange');
        $request->set_param('code', (string) $data['code']);
        $request->set_param('state', (string) $data['state']);

        $exchange = rest_do_request($request);
        $this->assertSame(403, $exchange->get_status());
    }

    public function test_user_b_cannot_authorize_with_user_a_xrpl_meta(): void {
        $user_a = $this->factory()->user->create();
        $user_b = $this->factory()->user->create();

        update_user_meta($user_a, 'xrpl-r-address', $this->valid_xrpl());
        wp_set_current_user($user_b);

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);
        $response = rest_do_request($request);

        $this->assertSame(400, $response->get_status());
    }

    public function test_code_cannot_be_redeemed_twice(): void {
        $response = $this->issue_code_response();
        $data = $response->get_data();

        $ok = $this->exchange_request((string) $data['code'], (string) $data['state']);
        $this->assertSame(200, $ok->get_status());

        $again = $this->exchange_request((string) $data['code'], (string) $data['state']);
        $this->assertSame(400, $again->get_status());
    }

    public function test_plaintext_code_not_stored_when_hashing_enabled(): void {
        global $wpdb;

        $response = $this->issue_code_response();
        $data = $response->get_data();

        $row = $wpdb->get_row($wpdb->prepare('SELECT code_hash FROM ' . $wpdb->prefix . 'calorieapp_auth_codes WHERE id = %s', $data['jti']), ARRAY_A);
        $this->assertNotEmpty($row);
        $this->assertNotSame($data['code'], $row['code_hash']);
        $this->assertSame(64, strlen((string) $row['code_hash']));
    }

    private function issue_code_response(): WP_REST_Response {
        $user_id = $this->factory()->user->create();
        wp_set_current_user($user_id);
        update_user_meta($user_id, 'xrpl-r-address', $this->valid_xrpl());

        $request = new WP_REST_Request('GET', '/calorieapp/v1/authorize');
        $request->set_param('state', $this->state());
        $request->set_param('redirect', false);

        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());

        return $response;
    }

    private function exchange_request(string $code, string $state): WP_REST_Response {
        $request = new WP_REST_Request('POST', '/calorieapp/v1/exchange');
        $request->set_param('code', $code);
        $request->set_param('state', $state);
        $request->set_header('x-calorieapp-bridge-secret', 'test-bridge-secret-123456');
        $request->set_header('x-calorieapp-client-id', 'calorieapp-backend');

        return rest_do_request($request);
    }

    private function state(): string {
        return 'state-' . wp_generate_password(64, false, false);
    }

    private function valid_xrpl(): string {
        return 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
    }
}
