<?php

namespace CalorieApp\IdentityBridge;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_User_Query;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WordPress-owned Xaman login for the embedded CalorieApp.
 *
 * The flow gives Xaman identical app and web return URLs. Xaman can therefore
 * redirect the active originating browser when possible and otherwise opens a
 * short-lived WordPress return endpoint in the device's selected browser. The
 * endpoint verifies the resolved payload server-side, authenticates WordPress,
 * completes CalorieApp authorization and returns to the originating site page.
 * The payload WebSocket remains a fallback when a mobile platform only resumes
 * the original page.
 */
class IntegratedLogin {
    private const REST_NAMESPACE = 'calorieapp/v1';
    private const FLOW_TTL_SECONDS = 10 * MINUTE_IN_SECONDS;
    private const START_RATE_WINDOW_SECONDS = 5 * MINUTE_IN_SECONDS;
    private const START_RATE_LIMIT = 10;
    private const XAMAN_API_BASE = 'https://xumm.app/api/v1/platform';
    private const FRONTEND_DEFAULT = 'https://calorieapp-frontend.onrender.com';

    private RestApi $rest_api;

    public function __construct(RestApi $rest_api) {
        $this->rest_api = $rest_api;
    }

    public function register_hooks(): void {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
        add_shortcode('calorieapp_embed', [$this, 'render_shortcode']);
    }

    public function register_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            '/integrated-login/start',
            [
                'methods' => 'POST',
                'callback' => [$this, 'start'],
                'permission_callback' => '__return_true',
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/integrated-login/finish',
            [
                'methods' => 'POST',
                'callback' => [$this, 'finish'],
                'permission_callback' => '__return_true',
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/integrated-login/authorize',
            [
                'methods' => 'POST',
                'callback' => [$this, 'authorize_calorieapp'],
                'permission_callback' => '__return_true',
            ]
        );

        register_rest_route(
            self::REST_NAMESPACE,
            '/integrated-login/return',
            [
                'methods' => 'GET',
                'callback' => [$this, 'return_from_xaman'],
                'permission_callback' => '__return_true',
            ]
        );
    }

    public function register_assets(): void {
        $base_url = plugin_dir_url(CALORIEAPP_IDENTITY_BRIDGE_FILE);
        $version = defined('CALORIEAPP_IDENTITY_BRIDGE_VERSION')
            ? CALORIEAPP_IDENTITY_BRIDGE_VERSION
            : '0.3.2';

        wp_register_style(
            'calorieapp-identity-bridge-embed',
            $base_url . 'assets/calorieapp-embed.css',
            [],
            $version
        );
        wp_register_script(
            'calorieapp-identity-bridge-embed',
            $base_url . 'assets/calorieapp-embed.js',
            [],
            $version,
            true
        );
    }

    public function render_shortcode($attributes = []): string {
        $attributes = shortcode_atts(
            [
                'src' => self::FRONTEND_DEFAULT,
                'height' => '1200',
                'locale' => '',
            ],
            is_array($attributes) ? $attributes : [],
            'calorieapp_embed'
        );

        $src = $this->sanitize_frontend_url((string) $attributes['src']);
        if ($src === '') {
            return '<p>CalorieApp embed URL is invalid.</p>';
        }

        $height = max(700, min(4000, (int) $attributes['height']));
        $requested_locale = trim((string) $attributes['locale']);
        if ($requested_locale === '') {
            $requested_locale = determine_locale();
        }
        $locale = LocaleRegistry::resolve($requested_locale);
        $iframe_src = add_query_arg(
            [
                'embedded' => '1',
                'locale' => $locale,
            ],
            $src
        );
        $instance_id = 'calorieapp-embed-' . wp_generate_uuid4();

        if (!wp_script_is('calorieapp-identity-bridge-embed', 'registered')) {
            $this->register_assets();
        }
        wp_enqueue_style('calorieapp-identity-bridge-embed');
        wp_enqueue_script('calorieapp-identity-bridge-embed');

        $start_url = rest_url(self::REST_NAMESPACE . '/integrated-login/start');
        $finish_url = rest_url(self::REST_NAMESPACE . '/integrated-login/finish');
        $authorize_url = rest_url(self::REST_NAMESPACE . '/integrated-login/authorize');
        $site_return_url = get_permalink();
        if (!is_string($site_return_url) || $site_return_url === '') {
            $site_return_url = home_url('/');
        }
        $logout_url = is_user_logged_in()
            ? wp_logout_url($site_return_url)
            : '';

        ob_start();
        ?>
        <div
            id="<?php echo esc_attr($instance_id); ?>"
            class="calorieapp-embed-shell"
            data-calorieapp-embed
            data-app-origin="<?php echo esc_attr($this->url_origin($src)); ?>"
            data-start-url="<?php echo esc_url($start_url); ?>"
            data-finish-url="<?php echo esc_url($finish_url); ?>"
            data-authorize-url="<?php echo esc_url($authorize_url); ?>"
            data-site-return-url="<?php echo esc_url($site_return_url); ?>"
            data-locale="<?php echo esc_attr($locale); ?>"
        >
            <?php if ($logout_url !== '') : ?>
                <div class="calorieapp-site-session-actions">
                    <button
                        type="button"
                        class="calorieapp-site-logout"
                        data-logout-url="<?php echo esc_url($logout_url); ?>"
                        data-idle-label="<?php echo esc_attr__('Log out of website and CalorieApp', 'calorieapp-identity-bridge'); ?>"
                    ><?php echo esc_html__('Log out of website and CalorieApp', 'calorieapp-identity-bridge'); ?></button>
                    <span class="calorieapp-site-logout-status" role="status" aria-live="polite" hidden></span>
                </div>
            <?php endif; ?>

            <iframe
                class="calorieapp-embed-frame"
                src="<?php echo esc_url($iframe_src); ?>"
                title="CalorieApp"
                style="height: <?php echo esc_attr((string) $height); ?>px"
                loading="eager"
                referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>

            <div class="calorieapp-login-modal" hidden role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($instance_id); ?>-title">
                <div class="calorieapp-login-card">
                    <button type="button" class="calorieapp-login-close" aria-label="Close sign-in window">&times;</button>
                    <h2 id="<?php echo esc_attr($instance_id); ?>-title">Sign in with Xaman</h2>
                    <p class="calorieapp-login-status" role="status" aria-live="polite">Preparing a secure sign-in request...</p>
                    <p class="calorieapp-login-guidance">
                        Sign in with Xaman, then use its return button. You will return to CalorieToken.net signed in to both the website and CalorieApp. If your phone resumes this page instead, sign-in finishes here automatically.
                    </p>
                    <img class="calorieapp-login-qr" alt="Scan this QR code with Xaman" hidden />
                    <a class="calorieapp-login-open" href="#" hidden>Open Xaman</a>
                    <button type="button" class="calorieapp-login-retry" hidden>Try again</button>
                </div>
            </div>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    public function start(WP_REST_Request $request) {
        $same_origin = $this->require_same_origin($request);
        if ($same_origin instanceof WP_Error) {
            return $same_origin;
        }

        $rate_limit = $this->consume_start_rate_limit();
        if ($rate_limit instanceof WP_Error) {
            return $rate_limit;
        }

        $locale = LocaleRegistry::resolve((string) $request->get_param('locale'));
        $backend_state = trim((string) $request->get_param('state'));
        if (!$this->is_valid_state($backend_state)) {
            return new WP_Error(
                'invalid_state',
                'CalorieApp state is invalid.',
                ['status' => 400]
            );
        }

        $site_return_url = $this->sanitize_site_return_url(
            (string) $request->get_param('return_url')
        );
        if ($site_return_url === '') {
            return new WP_Error(
                'invalid_return_url',
                'The site return URL is invalid.',
                ['status' => 400]
            );
        }

        $credentials = $this->xaman_credentials();
        if ($credentials instanceof WP_Error) {
            return $credentials;
        }

        $flow_id = wp_generate_uuid4();
        $proof = $this->random_token();
        $return_token = $this->random_token();
        // Xaman limits custom payload identifiers to 40 characters. Keep the
        // full 128-bit UUID while using a short, recognizable prefix.
        $identifier = 'calapp_' . str_replace('-', '', $flow_id);
        $return_url = add_query_arg(
            [
                'flow_id' => $flow_id,
                'return_token' => $return_token,
            ],
            rest_url(self::REST_NAMESPACE . '/integrated-login/return')
        );

        $response = wp_remote_post(
            self::XAMAN_API_BASE . '/payload',
            [
                'timeout' => 15,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-API-Key' => $credentials['key'],
                    'X-API-Secret' => $credentials['secret'],
                ],
                'body' => wp_json_encode(
                    [
                        'txjson' => ['TransactionType' => 'SignIn'],
                        'options' => [
                            'submit' => true,
                            'return_url' => [
                                'app' => $return_url,
                                'web' => $return_url,
                            ],
                        ],
                        'custom_meta' => [
                            'identifier' => $identifier,
                            'instruction' => 'Sign in to CalorieApp and CalorieToken.net',
                        ],
                    ]
                ),
            ]
        );

        if (is_wp_error($response)) {
            return new WP_Error(
                'xaman_unavailable',
                'Xaman could not be reached. Please try again.',
                ['status' => 502]
            );
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode((string) wp_remote_retrieve_body($response), true);
        if ($status === 429) {
            return new WP_Error(
                'xaman_rate_limited',
                'Xaman is temporarily busy. Wait before trying again.',
                ['status' => 429]
            );
        }
        if ($status < 200 || $status >= 300 || !is_array($body)) {
            return new WP_Error(
                'xaman_payload_failed',
                'Xaman could not create the sign-in request.',
                ['status' => 502]
            );
        }

        $payload_uuid = trim((string) ($body['uuid'] ?? ''));
        $next_url = trim((string) ($body['next']['always'] ?? ''));
        $qr_url = trim((string) ($body['refs']['qr_png'] ?? ''));
        $websocket_url = trim((string) ($body['refs']['websocket_status'] ?? ''));

        if (
            !$this->is_uuid($payload_uuid)
            || !$this->is_xaman_https_url($next_url)
            || !$this->is_xaman_https_url($qr_url)
            || !$this->is_xaman_websocket_url($websocket_url)
        ) {
            return new WP_Error(
                'xaman_payload_malformed',
                'Xaman returned an invalid sign-in request.',
                ['status' => 502]
            );
        }

        $expires_at = time() + self::FLOW_TTL_SECONDS;
        $flow = [
            'proof_hash' => $this->hash_proof($proof),
            'return_token_hash' => $this->hash_proof($return_token),
            'payload_uuid' => $payload_uuid,
            'identifier' => $identifier,
            'status' => 'pending',
            'wp_user_id' => 0,
            'backend_state_hash' => '',
            'backend_state' => $backend_state,
            'site_return_url' => $site_return_url,
            'return_consumed' => false,
            'locale' => $locale,
            'expires_at' => $expires_at,
        ];
        if (!set_transient($this->flow_key($flow_id), $flow, self::FLOW_TTL_SECONDS)) {
            return new WP_Error(
                'flow_storage_failed',
                'The secure sign-in request could not be stored.',
                ['status' => 500]
            );
        }

        return $this->no_store_response(
            [
                'flow_id' => $flow_id,
                'flow_proof' => $proof,
                'expires_at' => gmdate(DATE_ATOM, $expires_at),
                'next_url' => $next_url,
                'qr_png_url' => $qr_url,
                'websocket_url' => $websocket_url,
                'locale' => $locale,
            ],
            201
        );
    }

    public function finish(WP_REST_Request $request) {
        $same_origin = $this->require_same_origin($request);
        if ($same_origin instanceof WP_Error) {
            return $same_origin;
        }

        $loaded = $this->load_flow_from_request($request);
        if ($loaded instanceof WP_Error) {
            return $loaded;
        }

        [$flow_id, $flow] = $loaded;
        $user_id = $this->authenticate_signed_flow($flow_id, $flow);
        if ($user_id instanceof WP_Error) {
            if ($user_id->get_error_code() === 'xaman_request_pending') {
                return $this->no_store_response(['status' => 'pending'], 202);
            }
            return $user_id;
        }

        return $this->no_store_response(
            [
                'status' => 'wordpress_authenticated',
                'wp_user_id' => $user_id,
            ]
        );
    }

    public function return_from_xaman(WP_REST_Request $request) {
        $flow_id = trim((string) $request->get_param('flow_id'));
        $return_token = trim((string) $request->get_param('return_token'));
        if (!$this->is_uuid($flow_id) || !$this->is_token($return_token)) {
            return new WP_Error(
                'invalid_return',
                'The Xaman return request is invalid.',
                ['status' => 400]
            );
        }

        $flow = get_transient($this->flow_key($flow_id));
        if (
            !is_array($flow)
            || !isset(
                $flow['return_token_hash'],
                $flow['expires_at'],
                $flow['backend_state'],
                $flow['site_return_url'],
                $flow['locale'],
                $flow['payload_uuid'],
                $flow['identifier'],
                $flow['return_consumed']
            )
            || (int) $flow['expires_at'] < time()
            || !hash_equals(
                (string) $flow['return_token_hash'],
                $this->hash_proof($return_token)
            )
        ) {
            return new WP_Error(
                'return_not_found',
                'The Xaman return request expired or was not found.',
                ['status' => 404]
            );
        }
        if (($flow['return_consumed'] ?? false) === true) {
            return new WP_Error(
                'return_already_used',
                'The Xaman return request was already used.',
                ['status' => 409]
            );
        }

        $site_return_url = (string) $flow['site_return_url'];

        $user_id = $this->authenticate_signed_flow($flow_id, $flow);
        if ($user_id instanceof WP_Error) {
            return $user_id;
        }

        $state = trim((string) ($flow['backend_state'] ?? ''));
        $locale = LocaleRegistry::resolve((string) ($flow['locale'] ?? 'en'));
        if (!$this->is_valid_state($state)) {
            return new WP_Error(
                'invalid_state',
                'CalorieApp state is invalid.',
                ['status' => 400]
            );
        }

        $result = $this->rest_api->authorize_current_user($user_id, $state, '', $locale);
        if ($result instanceof WP_Error) {
            return $result;
        }

        $flow['backend_state_hash'] = hash('sha256', $state);
        $flow['return_consumed'] = true;
        if (!set_transient(
            $this->flow_key($flow_id),
            $flow,
            $this->remaining_flow_ttl($flow)
        )) {
            return new WP_Error(
                'flow_storage_failed',
                'The secure sign-in return could not be finalized.',
                ['status' => 500]
            );
        }

        $redirect_url = add_query_arg(
            [
                'return_to' => 'wordpress',
                'site_return' => $site_return_url,
            ],
            (string) $result['redirect_url']
        );
        $response = new WP_REST_Response(null, 302);
        $response->header('Location', $redirect_url);
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->header('Pragma', 'no-cache');
        $response->header('Referrer-Policy', 'no-referrer');
        return $response;
    }

    public function authorize_calorieapp(WP_REST_Request $request) {
        $same_origin = $this->require_same_origin($request);
        if ($same_origin instanceof WP_Error) {
            return $same_origin;
        }

        $loaded = $this->load_flow_from_request($request);
        if ($loaded instanceof WP_Error) {
            return $loaded;
        }

        [$flow_id, $flow] = $loaded;
        if ((string) $flow['status'] !== 'authenticated' || (int) $flow['wp_user_id'] <= 0) {
            return new WP_Error(
                'wordpress_not_authenticated',
                'WordPress sign-in has not completed yet.',
                ['status' => 409]
            );
        }

        $state = trim((string) $request->get_param('state'));
        if (!$this->is_valid_state($state)) {
            return new WP_Error(
                'invalid_state',
                'CalorieApp state is invalid.',
                ['status' => 400]
            );
        }

        $flow_locale = LocaleRegistry::resolve((string) ($flow['locale'] ?? 'en'));
        $requested_locale = trim((string) $request->get_param('locale'));
        if (
            $requested_locale !== ''
            && !hash_equals($flow_locale, LocaleRegistry::resolve($requested_locale))
        ) {
            return new WP_Error(
                'locale_mismatch',
                'This sign-in flow is bound to another language context.',
                ['status' => 409]
            );
        }

        $state_hash = hash('sha256', $state);
        $existing_state_hash = (string) ($flow['backend_state_hash'] ?? '');
        if ($existing_state_hash !== '' && !hash_equals($existing_state_hash, $state_hash)) {
            return new WP_Error(
                'state_mismatch',
                'This sign-in flow is already bound to another CalorieApp request.',
                ['status' => 409]
            );
        }

        $user_id = (int) $flow['wp_user_id'];
        $this->authenticate_wordpress_user($user_id);
        $result = $this->rest_api->authorize_current_user($user_id, $state, '', $flow_locale);
        if ($result instanceof WP_Error) {
            return $result;
        }

        $flow['backend_state_hash'] = $state_hash;
        set_transient(
            $this->flow_key($flow_id),
            $flow,
            $this->remaining_flow_ttl($flow)
        );

        return $this->no_store_response(
            [
                'status' => 'authorized',
                'code' => (string) $result['code'],
                'state' => (string) $result['state'],
                'expires_at' => (string) $result['expires_at'],
                'locale' => (string) $result['locale'],
            ]
        );
    }

    private function authenticate_signed_flow(string $flow_id, array &$flow) {
        if ((string) ($flow['status'] ?? '') === 'authenticated') {
            $user_id = (int) ($flow['wp_user_id'] ?? 0);
            if ($user_id <= 0) {
                return new WP_Error(
                    'wordpress_user_missing',
                    'The authenticated WordPress user is unavailable.',
                    ['status' => 409]
                );
            }
            $this->authenticate_wordpress_user($user_id);
            return $user_id;
        }

        $payload = $this->fetch_xaman_payload((string) ($flow['payload_uuid'] ?? ''));
        if ($payload instanceof WP_Error) {
            return $payload;
        }

        $meta = isset($payload['meta']) && is_array($payload['meta'])
            ? $payload['meta']
            : [];
        $resolved = ($meta['resolved'] ?? false) === true;
        $signed = ($meta['signed'] ?? false) === true;

        if (!$resolved) {
            if (($meta['cancelled'] ?? false) === true || ($meta['expired'] ?? false) === true) {
                delete_transient($this->flow_key($flow_id));
                return new WP_Error(
                    'xaman_request_expired',
                    'The Xaman sign-in request expired or was cancelled.',
                    ['status' => 410]
                );
            }

            return new WP_Error(
                'xaman_request_pending',
                'The Xaman sign-in request is still pending.',
                ['status' => 202]
            );
        }

        if (!$signed) {
            delete_transient($this->flow_key($flow_id));
            return new WP_Error(
                'xaman_request_rejected',
                'The Xaman sign-in request was rejected.',
                ['status' => 400]
            );
        }

        $tx_type = strtolower(trim((string) ($payload['payload']['tx_type'] ?? '')));
        $account = trim((string) ($payload['response']['account'] ?? ''));
        $identifier = trim((string) ($payload['custom_meta']['identifier'] ?? ''));
        if (
            $tx_type !== 'signin'
            || !$this->is_valid_xrpl_classic_address($account)
            || !hash_equals((string) ($flow['identifier'] ?? ''), $identifier)
        ) {
            return new WP_Error(
                'xaman_identity_invalid',
                'The signed Xaman identity could not be verified.',
                ['status' => 400]
            );
        }

        $user_id = $this->find_or_create_wordpress_user($account);
        if ($user_id instanceof WP_Error) {
            return $user_id;
        }

        $this->authenticate_wordpress_user($user_id);
        $flow['status'] = 'authenticated';
        $flow['wp_user_id'] = $user_id;
        if (!set_transient(
            $this->flow_key($flow_id),
            $flow,
            $this->remaining_flow_ttl($flow)
        )) {
            return new WP_Error(
                'flow_storage_failed',
                'The secure sign-in request could not be finalized.',
                ['status' => 500]
            );
        }

        return $user_id;
    }

    private function fetch_xaman_payload(string $payload_uuid) {
        $credentials = $this->xaman_credentials();
        if ($credentials instanceof WP_Error) {
            return $credentials;
        }

        $response = wp_remote_get(
            self::XAMAN_API_BASE . '/payload/' . rawurlencode($payload_uuid),
            [
                'timeout' => 15,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-API-Key' => $credentials['key'],
                    'X-API-Secret' => $credentials['secret'],
                ],
            ]
        );

        if (is_wp_error($response)) {
            return new WP_Error(
                'xaman_unavailable',
                'Xaman status could not be verified.',
                ['status' => 502]
            );
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode((string) wp_remote_retrieve_body($response), true);
        if ($status === 429) {
            return new WP_Error(
                'xaman_rate_limited',
                'Xaman is temporarily busy. Wait before trying again.',
                ['status' => 429]
            );
        }
        if ($status !== 200 || !is_array($body)) {
            return new WP_Error(
                'xaman_status_failed',
                'Xaman status could not be verified.',
                ['status' => 502]
            );
        }

        return $body;
    }

    private function find_or_create_wordpress_user(string $account) {
        $query = new WP_User_Query(
            [
                'meta_key' => 'xrpl-r-address',
                'meta_value' => $account,
                'meta_compare' => '=',
                'number' => 2,
                'fields' => 'ids',
            ]
        );
        $matches = $query->get_results();
        if (is_array($matches) && count($matches) > 0) {
            return (int) $matches[0];
        }

        if ((string) get_option('xummlogin_create_user', '0') !== '1') {
            return new WP_Error(
                'wordpress_user_missing',
                'No WordPress account is linked to this XRPL address.',
                ['status' => 403]
            );
        }

        do {
            $username = 'calorie_' . strtolower(wp_generate_password(12, false, false));
            $username = sanitize_user($username, true);
        } while ($username === '' || username_exists($username));

        $user_id = wp_create_user($username, wp_generate_password(32, true, true));
        if (is_wp_error($user_id)) {
            return new WP_Error(
                'wordpress_user_create_failed',
                'A WordPress account could not be created for this XRPL address.',
                ['status' => 500]
            );
        }

        update_user_meta((int) $user_id, 'xrpl-r-address', $account);
        return (int) $user_id;
    }

    private function authenticate_wordpress_user(int $user_id): void {
        if ($user_id <= 0) {
            return;
        }

        $user = get_user_by('id', $user_id);
        if (!$user) {
            return;
        }

        wp_clear_auth_cookie();
        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, false, is_ssl());
        do_action('wp_login', $user->user_login, $user);
    }

    private function load_flow_from_request(WP_REST_Request $request) {
        $flow_id = trim((string) $request->get_param('flow_id'));
        $proof = trim((string) $request->get_param('flow_proof'));

        if (!$this->is_uuid($flow_id) || !$this->is_token($proof)) {
            return new WP_Error(
                'invalid_flow',
                'The secure sign-in flow is invalid.',
                ['status' => 400]
            );
        }

        $flow = get_transient($this->flow_key($flow_id));
        if (!is_array($flow) || !isset($flow['proof_hash'], $flow['expires_at'])) {
            return new WP_Error(
                'flow_not_found',
                'The secure sign-in flow expired or was not found.',
                ['status' => 404]
            );
        }

        if (
            (int) $flow['expires_at'] < time()
            || !hash_equals((string) $flow['proof_hash'], $this->hash_proof($proof))
        ) {
            return new WP_Error(
                'flow_not_found',
                'The secure sign-in flow expired or was not found.',
                ['status' => 404]
            );
        }

        return [$flow_id, $flow];
    }

    private function require_same_origin(WP_REST_Request $request) {
        $origin = trim((string) $request->get_header('origin'));
        if ($origin === '') {
            return new WP_Error(
                'origin_required',
                'A same-origin browser request is required.',
                ['status' => 403]
            );
        }

        if (!hash_equals($this->url_origin(home_url('/')), $this->url_origin($origin))) {
            return new WP_Error(
                'origin_forbidden',
                'The request origin is not allowed.',
                ['status' => 403]
            );
        }

        return true;
    }

    private function consume_start_rate_limit() {
        $remote_address = isset($_SERVER['REMOTE_ADDR'])
            ? sanitize_text_field(wp_unslash((string) $_SERVER['REMOTE_ADDR']))
            : 'unknown';
        $key = 'calorieapp_xaman_rate_' . substr(
            hash_hmac('sha256', $remote_address, wp_salt('nonce')),
            0,
            32
        );
        $count = (int) get_transient($key);
        if ($count >= self::START_RATE_LIMIT) {
            return new WP_Error(
                'start_rate_limited',
                'Too many sign-in requests. Wait a few minutes before trying again.',
                ['status' => 429]
            );
        }

        set_transient($key, $count + 1, self::START_RATE_WINDOW_SECONDS);
        return true;
    }

    private function xaman_credentials() {
        $key = trim((string) get_option('xummlogin_api_key', ''));
        $secret = trim((string) get_option('xummlogin_api_secret', ''));
        if ($key === '' || $secret === '') {
            return new WP_Error(
                'xaman_not_configured',
                'Xaman API credentials are not configured in XUMM Login.',
                ['status' => 500]
            );
        }

        return ['key' => $key, 'secret' => $secret];
    }

    private function no_store_response(array $data, int $status = 200): WP_REST_Response {
        $response = new WP_REST_Response($data, $status);
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->header('Pragma', 'no-cache');
        return $response;
    }

    private function sanitize_site_return_url(string $value): string {
        $value = trim($value);
        if ($value === '' || strlen($value) > 2048) {
            return '';
        }

        $url = esc_url_raw($value, ['http', 'https']);
        $parts = wp_parse_url($url);
        if (
            $url === ''
            || !is_array($parts)
            || isset($parts['user'])
            || isset($parts['pass'])
            || !hash_equals($this->url_origin(home_url('/')), $this->url_origin($url))
        ) {
            return '';
        }

        return $url;
    }

    private function sanitize_frontend_url(string $value): string {
        $value = trim($value);
        $url = esc_url_raw($value, ['https']);
        if ($url === '') {
            return '';
        }

        $parts = wp_parse_url($url);
        if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
            return '';
        }

        $candidate_origin = $this->url_origin($url);
        $allowed_origins = apply_filters(
            'calorieapp_identity_bridge_allowed_frontend_origins',
            [
                $this->url_origin(self::FRONTEND_DEFAULT),
                'https://app.calorietoken.net',
            ]
        );
        if (!is_array($allowed_origins)) {
            return '';
        }

        $allowed = false;
        foreach ($allowed_origins as $allowed_origin) {
            $normalized_origin = $this->url_origin((string) $allowed_origin);
            if (
                $candidate_origin !== ''
                && $normalized_origin !== ''
                && hash_equals($normalized_origin, $candidate_origin)
            ) {
                $allowed = true;
                break;
            }
        }
        if (!$allowed) {
            return '';
        }

        return untrailingslashit($url);
    }

    private function remaining_flow_ttl(array $flow): int {
        return max(1, (int) ($flow['expires_at'] ?? 0) - time());
    }

    private function url_origin(string $url): string {
        $parts = wp_parse_url($url);
        if (!is_array($parts)) {
            return '';
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $port = isset($parts['port']) ? (int) $parts['port'] : null;
        if ($scheme === '' || $host === '') {
            return '';
        }

        $origin = $scheme . '://' . $host;
        if ($port !== null && !(($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80))) {
            $origin .= ':' . $port;
        }

        return $origin;
    }

    private function is_xaman_https_url(string $value): bool {
        $parts = wp_parse_url($value);
        return is_array($parts)
            && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && strtolower((string) ($parts['host'] ?? '')) === 'xumm.app';
    }

    private function is_xaman_websocket_url(string $value): bool {
        $parts = wp_parse_url($value);
        return is_array($parts)
            && strtolower((string) ($parts['scheme'] ?? '')) === 'wss'
            && strtolower((string) ($parts['host'] ?? '')) === 'xumm.app';
    }

    private function is_valid_xrpl_classic_address(string $address): bool {
        return preg_match('/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/', $address) === 1;
    }

    private function is_valid_state(string $state): bool {
        return strlen($state) >= 32
            && strlen($state) <= 255
            && preg_match('/^[A-Za-z0-9\-_.~]+$/', $state) === 1;
    }

    private function is_uuid(string $value): bool {
        return preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $value
        ) === 1;
    }

    private function is_token(string $value): bool {
        return strlen($value) >= 40
            && strlen($value) <= 128
            && preg_match('/^[A-Za-z0-9_-]+$/', $value) === 1;
    }

    private function random_token(): string {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private function hash_proof(string $proof): string {
        return hash_hmac('sha256', $proof, wp_salt('auth'));
    }

    private function flow_key(string $flow_id): string {
        return 'calorieapp_xaman_' . str_replace('-', '', strtolower($flow_id));
    }
}
