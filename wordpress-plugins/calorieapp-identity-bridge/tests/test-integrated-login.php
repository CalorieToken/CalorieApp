<?php

use CalorieApp\IdentityBridge\IntegratedLogin;
use CalorieApp\IdentityBridge\Plugin;
use CalorieApp\IdentityBridge\RestApi;
use CalorieApp\IdentityBridge\Storage;

class Test_CalorieApp_Integrated_Login extends WP_UnitTestCase {
    private string $identifier = '';
    private bool $resolved = false;
    private string $backend_locale = 'en';
    private string $started_state = '';
    private ?bool $remember_auth_cookie = null;

    public function setUp(): void {
        parent::setUp();

        (new Storage())->create_table();
        update_option(
            Plugin::OPTION_KEY,
            [
                'callback_allowlist' => "https://app.calorietoken.net/auth/callback",
                'default_callback_url' => 'https://app.calorietoken.net/auth/callback',
                'calorieapp_backend_url' => 'https://app.calorietoken.net',
                'bridge_secret' => 'test-bridge-secret-123456',
                'backend_client_id' => 'calorieapp-backend',
                'code_ttl_seconds' => 60,
            ],
            false
        );
        update_option('xummlogin_api_key', 'test-xaman-key', false);
        update_option('xummlogin_api_secret', 'test-xaman-secret', false);
        update_option('xummlogin_create_user', '1', false);
        $_SERVER['REMOTE_ADDR'] = '192.0.2.' . random_int(1, 250);

        add_filter('pre_http_request', [$this, 'mock_http'], 10, 3);
        add_filter('auth_cookie_expiration', [$this, 'capture_auth_cookie_mode'], 10, 3);
    }

    public function tearDown(): void {
        global $wpdb;
        $wpdb->query('TRUNCATE TABLE ' . $wpdb->prefix . 'calorieapp_auth_codes');
        wp_set_current_user(0);
        remove_filter('pre_http_request', [$this, 'mock_http'], 10);
        remove_filter('auth_cookie_expiration', [$this, 'capture_auth_cookie_mode'], 10);
        parent::tearDown();
    }

    public function capture_auth_cookie_mode(int $length, int $user_id, bool $remember): int {
        $this->remember_auth_cookie = $remember;
        return $length;
    }

    public function mock_http($preempt, array $request, string $url) {
        if ($url === 'https://xumm.app/api/v1/platform/payload') {
            $body = json_decode((string) ($request['body'] ?? ''), true);
            $this->identifier = (string) ($body['custom_meta']['identifier'] ?? '');

            $this->assertSame('SignIn', $body['txjson']['TransactionType']);
            $this->assertArrayNotHasKey('return_url', $body['options']);
            $this->assertMatchesRegularExpression('/^calapp_[a-f0-9]{32}$/', $this->identifier);
            $this->assertLessThanOrEqual(40, strlen($this->identifier));
            $headers = array_change_key_case((array) ($request['headers'] ?? []), CASE_LOWER);
            $this->assertSame('test-xaman-key', (string) ($headers['x-api-key'] ?? ''));
            $this->assertSame('test-xaman-secret', (string) ($headers['x-api-secret'] ?? ''));

            return $this->http_response(
                200,
                [
                    'uuid' => '1289e9ae-7d5d-4d5f-b89c-18633112ce09',
                    'next' => [
                        'always' => 'https://xumm.app/sign/1289e9ae-7d5d-4d5f-b89c-18633112ce09',
                    ],
                    'refs' => [
                        'qr_png' => 'https://xumm.app/sign/1289e9ae-7d5d-4d5f-b89c-18633112ce09_q.png',
                        'websocket_status' => 'wss://xumm.app/sign/1289e9ae-7d5d-4d5f-b89c-18633112ce09',
                    ],
                ]
            );
        }

        if (strpos($url, 'https://xumm.app/api/v1/platform/payload/') === 0) {
            return $this->http_response(
                200,
                $this->resolved
                    ? [
                        'meta' => [
                            'resolved' => true,
                            'signed' => true,
                            'cancelled' => false,
                            'expired' => false,
                        ],
                        'payload' => ['tx_type' => 'SignIn'],
                        'response' => ['account' => $this->valid_xrpl()],
                        'custom_meta' => ['identifier' => $this->identifier],
                    ]
                    : [
                        'meta' => [
                            'resolved' => false,
                            'signed' => false,
                            'cancelled' => false,
                            'expired' => false,
                        ],
                    ]
            );
        }

        if (strpos($url, '/api/identity/login/state/validate') !== false) {
            return $this->http_response(200, ['valid' => true, 'locale' => $this->backend_locale]);
        }

        return $preempt;
    }

    public function test_start_requires_same_wordpress_origin(): void {
        $request = new WP_REST_Request('POST', '/calorieapp/v1/integrated-login/start');
        $request->set_header('origin', 'https://evil.example');

        $response = rest_do_request($request);
        $this->assertSame(403, $response->get_status());
    }

    public function test_start_returns_browser_safe_payload_references_only(): void {
        $response = $this->start_flow();
        $data = $response->get_data();

        $this->assertSame(201, $response->get_status());
        $this->assertArrayHasKey('flow_id', $data);
        $this->assertArrayHasKey('flow_proof', $data);
        $this->assertArrayHasKey('next_url', $data);
        $this->assertArrayHasKey('qr_png_url', $data);
        $this->assertArrayHasKey('websocket_url', $data);
        $this->assertSame('en', $data['locale']);
        $this->assertStringNotContainsString('test-xaman-secret', wp_json_encode($data));
        $this->assertStringNotContainsString('return_token', wp_json_encode($data));
    }

    public function test_start_resolves_locale_alias_into_flow_context(): void {
        $response = $this->start_flow('nl-NL');

        $this->assertSame(201, $response->get_status());
        $this->assertSame('nl', $response->get_data()['locale']);
    }

    public function test_finish_stays_pending_until_xaman_resolves(): void {
        $flow = $this->start_flow()->get_data();
        $response = $this->finish_flow($flow);

        $this->assertSame(202, $response->get_status());
        $this->assertSame('pending', $response->get_data()['status']);
    }

    public function test_resolved_signin_authenticates_wordpress_in_originating_request(): void {
        $flow = $this->start_flow()->get_data();
        $this->resolved = true;

        $response = $this->finish_flow($flow);

        $this->assertSame(200, $response->get_status());
        $this->assertSame('wordpress_authenticated', $response->get_data()['status']);
        $this->assertGreaterThan(0, get_current_user_id());
        $this->assertSame(
            $this->valid_xrpl(),
            get_user_meta(get_current_user_id(), 'xrpl-r-address', true)
        );
        $this->assertFalse($this->remember_auth_cookie);
    }

    public function test_completed_flow_issues_calorieapp_code_for_same_user(): void {
        $flow = $this->start_flow()->get_data();
        $this->resolved = true;
        $this->finish_flow($flow);

        $request = $this->same_origin_request(
            'POST',
            '/calorieapp/v1/integrated-login/authorize'
        );
        $request->set_param('flow_id', $flow['flow_id']);
        $request->set_param('flow_proof', $flow['flow_proof']);
        $request->set_param('state', $this->state());
        $request->set_param('locale', 'en');

        $mismatch_response = rest_do_request($request);
        $this->assertSame(409, $mismatch_response->get_status());
        $this->assertSame('state_mismatch', $mismatch_response->get_data()['code']);

        $request->set_param('state', $this->started_state);

        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertSame('authorized', $response->get_data()['status']);
        $this->assertNotEmpty($response->get_data()['code']);
        $this->assertSame('en', $response->get_data()['locale']);
    }

    public function test_non_english_flow_allows_missing_locale_but_rejects_explicit_mismatch(): void {
        $flow = $this->start_flow('nl-NL')->get_data();
        $this->backend_locale = 'nl';
        $this->resolved = true;
        $this->finish_flow($flow);

        $mismatch_request = $this->same_origin_request(
            'POST',
            '/calorieapp/v1/integrated-login/authorize'
        );
        $mismatch_request->set_param('flow_id', $flow['flow_id']);
        $mismatch_request->set_param('flow_proof', $flow['flow_proof']);
        $mismatch_request->set_param('state', $this->state());
        $mismatch_request->set_param('locale', 'en');

        $mismatch_response = rest_do_request($mismatch_request);
        $this->assertSame(409, $mismatch_response->get_status());
        $this->assertSame('locale_mismatch', $mismatch_response->get_data()['code']);

        $request = $this->same_origin_request(
            'POST',
            '/calorieapp/v1/integrated-login/authorize'
        );
        $request->set_param('flow_id', $flow['flow_id']);
        $request->set_param('flow_proof', $flow['flow_proof']);
        $request->set_param('state', $this->started_state);

        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertSame('authorized', $response->get_data()['status']);
        $this->assertSame('nl', $response->get_data()['locale']);
    }

    public function test_wrong_flow_proof_cannot_finish_signin(): void {
        $flow = $this->start_flow()->get_data();
        $this->resolved = true;
        $flow['flow_proof'] = str_repeat('A', 43);

        $response = $this->finish_flow($flow);
        $this->assertSame(404, $response->get_status());
        $this->assertSame(0, get_current_user_id());
    }

    public function test_shortcode_embeds_app_without_exposing_credentials(): void {
        $html = do_shortcode('[calorieapp_embed]');

        $this->assertStringContainsString('embedded=1', $html);
        $this->assertStringContainsString('data-calorieapp-embed', $html);
        $this->assertStringContainsString(
            'data-site-return-url="' . esc_url(home_url('/')),
            $html
        );
        $this->assertStringNotContainsString('calorieapp-site-logout', $html);
        $this->assertStringNotContainsString('test-xaman-key', $html);
        $this->assertStringNotContainsString('test-xaman-secret', $html);
    }

    public function test_shortcode_renders_joint_site_logout_for_authenticated_users(): void {
        $user_id = self::factory()->user->create();
        wp_set_current_user($user_id);

        $html = do_shortcode('[calorieapp_embed]');

        $this->assertStringContainsString('class="calorieapp-site-logout"', $html);
        $this->assertStringContainsString('action=logout', $html);
        $this->assertStringContainsString(
            'Sign out both',
            $html
        );
        $this->assertStringContainsString('Connected', $html);
        $this->assertStringContainsString('Website + CalorieApp', $html);
    }

    public function test_sitewide_widget_renders_joint_logout_for_authenticated_users(): void {
        $user_id = self::factory()->user->create();
        wp_set_current_user($user_id);
        $integrated_login = new IntegratedLogin(new RestApi(new Storage()));

        ob_start();
        $integrated_login->render_sitewide_session_actions();
        $html = (string) ob_get_clean();

        $this->assertStringContainsString(
            'data-calorieapp-sitewide-session-actions',
            $html
        );
        $this->assertStringContainsString(
            'data-app-origin="https://app.calorietoken.net"',
            $html
        );
        $this->assertStringContainsString('embedded=1', $html);
        $this->assertStringContainsString('class="calorieapp-site-logout"', $html);
        $this->assertStringContainsString('Sign out both', $html);
        $this->assertStringContainsString('action=logout', $html);
    }

    public function test_sitewide_widget_omits_logout_for_signed_out_visitors(): void {
        $integrated_login = new IntegratedLogin(new RestApi(new Storage()));

        ob_start();
        $integrated_login->render_sitewide_session_actions();
        $html = (string) ob_get_clean();

        $this->assertSame('', $html);
    }

    public function test_sitewide_logout_returns_to_the_queried_page_not_the_loop_post(): void {
        $user_id = self::factory()->user->create();
        wp_set_current_user($user_id);
        $queried_page_id = self::factory()->post->create(['post_type' => 'page']);
        $loop_post_id = self::factory()->post->create();
        $this->go_to(get_permalink($queried_page_id));
        $GLOBALS['post'] = get_post($loop_post_id);
        $integrated_login = new IntegratedLogin(new RestApi(new Storage()));

        ob_start();
        $integrated_login->render_sitewide_session_actions();
        $html = (string) ob_get_clean();

        $this->assertStringContainsString(
            esc_url(wp_logout_url(get_permalink($queried_page_id))),
            $html
        );
        $this->assertStringNotContainsString(
            rawurlencode(get_permalink($loop_post_id)),
            $html
        );
    }

    public function test_shortcode_resolves_locale_alias_into_embed_context(): void {
        $html = do_shortcode('[calorieapp_embed locale="nl-NL"]');

        $this->assertStringContainsString('locale=nl', $html);
        $this->assertStringContainsString('data-locale="nl"', $html);
    }

    public function test_shortcode_rejects_untrusted_frontend_origin(): void {
        $html = do_shortcode('[calorieapp_embed src="https://evil.example/phishing"]');

        $this->assertSame('<p>CalorieApp embed URL is invalid.</p>', $html);
        $this->assertStringNotContainsString('evil.example', $html);
    }

    public function test_shortcode_accepts_same_site_frontend_origin(): void {
        $html = do_shortcode('[calorieapp_embed src="https://app.calorietoken.net"]');

        $this->assertStringContainsString('https://app.calorietoken.net?embedded=1', $html);
        $this->assertStringContainsString('data-app-origin="https://app.calorietoken.net"', $html);
    }

    public function test_calorieapp_page_ending_renders_once_after_shortcode(): void {
        $integrated_login = new IntegratedLogin(new RestApi(new Storage()));

        ob_start();
        $integrated_login->render_calorieapp_page_ending();
        $this->assertSame('', (string) ob_get_clean());

        $integrated_login->render_shortcode(
            ['src' => 'https://app.calorietoken.net']
        );

        ob_start();
        $integrated_login->render_calorieapp_page_ending();
        $html = (string) ob_get_clean();

        $this->assertStringContainsString(
            'data-calorieapp-shared-page-ending',
            $html
        );
        $this->assertStringContainsString(
            esc_url(home_url('/index.php/calorieapp/')),
            $html
        );
        $this->assertSame(
            3,
            substr_count(
                $html,
                'class="calorieapp-page-tool-position calorieapp-page-tool-position-'
            )
        );
        $this->assertStringContainsString('home-minimal.svg#nc_icon', $html);
        $this->assertStringContainsString('square-upload.svg#nc_icon', $html);
        $this->assertStringContainsString(
            esc_url(
                content_url(
                    '/plugins/brizy/public/editor-build/prod/editor/icons/glyph/home-minimal.svg#nc_icon'
                )
            ),
            $html
        );
        $this->assertStringContainsString(
            esc_url(
                content_url(
                    '/plugins/brizy/public/editor-build/prod/editor/icons/glyph/square-upload.svg#nc_icon'
                )
            ),
            $html
        );
        $this->assertStringContainsString('<img class="calorieapp-page-tool-logo"', $html);
        $this->assertStringContainsString('https://app.calorietoken.net/logo.png', $html);
        $this->assertStringContainsString('width="48" height="48"', $html);
        $this->assertStringContainsString('data-calorieapp-social-carousel', $html);
        $this->assertStringContainsString('calorieapp-shared-social-track', $html);
        $this->assertStringContainsString('facebook.svg#fa_icon', $html);
        $this->assertStringContainsString('instagram-square.svg#fa_icon', $html);
        $this->assertStringContainsString('Operator: ICTHendrikse · KVK 73774693', $html);
        $this->assertStringContainsString(
            '© ' . wp_date('Y') . ' ICTHendrikse (owned content only)',
            $html
        );
        $this->assertStringContainsString('Privacy Policy', $html);
        $this->assertStringContainsString('Terms &amp; Conditions', $html);
        $this->assertStringContainsString('https://github.com/CalorieToken', $html);

        ob_start();
        $integrated_login->render_calorieapp_page_ending();
        $this->assertSame('', (string) ob_get_clean());
    }

    private function start_flow(string $locale = 'en'): WP_REST_Response {
        $request = $this->same_origin_request(
            'POST',
            '/calorieapp/v1/integrated-login/start'
        );
        $request->set_param('locale', $locale);
        $this->started_state = $this->state();
        $request->set_param('state', $this->started_state);
        $response = rest_do_request($request);
        $this->assertInstanceOf(WP_REST_Response::class, $response);
        return $response;
    }

    private function finish_flow(array $flow): WP_REST_Response {
        $request = $this->same_origin_request(
            'POST',
            '/calorieapp/v1/integrated-login/finish'
        );
        $request->set_param('flow_id', $flow['flow_id']);
        $request->set_param('flow_proof', $flow['flow_proof']);
        return rest_do_request($request);
    }

    private function same_origin_request(string $method, string $route): WP_REST_Request {
        $request = new WP_REST_Request($method, $route);
        $request->set_header('origin', untrailingslashit(home_url('/')));
        return $request;
    }

    private function http_response(int $status, array $body): array {
        return [
            'headers' => [],
            'body' => wp_json_encode($body),
            'response' => ['code' => $status, 'message' => 'Test response'],
            'cookies' => [],
            'filename' => null,
        ];
    }

    private function state(): string {
        return 'state-' . wp_generate_password(64, false, false);
    }

    private function valid_xrpl(): string {
        return 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
    }
}
