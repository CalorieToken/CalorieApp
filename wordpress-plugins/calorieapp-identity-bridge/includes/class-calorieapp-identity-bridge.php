<?php

namespace CalorieApp\IdentityBridge;

use WP_Error;
use WP_REST_Response;

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-calorieapp-identity-bridge-storage.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-locale-registry.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-rest.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-browser-authorize.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-integrated-login.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-admin.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-legal-footer-compatibility.php';

/**
 * Replaces the retired LiveCoinWatch card with XPMarket's public CAL feed.
 *
 * XPMarket's token pages reject third-party iframes and its JSON endpoint does
 * not expose browser CORS headers. WordPress therefore proxies only the small,
 * public widget payload and caches it to stay well below XPMarket's rate limit.
 */
class MarketWidget {
    private const REST_NAMESPACE = 'calorieapp/v1';
    private const REST_ROUTE = '/xpmarket-widget';
    private const TOKEN = 'Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY';
    private const TOKEN_PAGE = 'https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY';
    private const API_URL = 'https://api.xpmarket.com/api/currency/widget?token=Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY';
    private const CACHE_KEY = 'calorieapp_xpmarket_widget_v1';
    private const CACHE_TTL_SECONDS = 5 * MINUTE_IN_SECONDS;

    public function register_hooks(): void {
        add_action('rest_api_init', [$this, 'register_route']);
        add_action('wp_enqueue_scripts', [$this, 'add_browser_config'], 20);
    }

    public function register_route(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            self::REST_ROUTE,
            [
                'methods' => 'GET',
                'callback' => [$this, 'get_widget'],
                'permission_callback' => '__return_true',
            ]
        );
    }

    public function add_browser_config(): void {
        if (!wp_script_is('calorieapp-identity-bridge-embed', 'registered')) {
            return;
        }

        wp_localize_script(
            'calorieapp-identity-bridge-embed',
            'calorieappIdentityBridgeChrome',
            [
                'xpMarketWidgetUrl' => rest_url(self::REST_NAMESPACE . self::REST_ROUTE),
                'xpMarketTokenUrl' => self::TOKEN_PAGE,
                'logoUrl' => plugin_dir_url(CALORIEAPP_IDENTITY_BRIDGE_FILE)
                    . 'assets/calorieapp-logo.png',
            ]
        );
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    public function get_widget() {
        $cached = get_transient(self::CACHE_KEY);
        if (is_array($cached)) {
            return $this->response($cached);
        }

        $upstream = wp_safe_remote_get(
            self::API_URL,
            [
                'headers' => ['Accept' => 'application/json'],
                'redirection' => 2,
                'timeout' => 8,
                'user-agent' => 'CalorieToken WordPress XPMarket widget/1.0',
            ]
        );

        if (is_wp_error($upstream)) {
            return new WP_Error(
                'calorieapp_xpmarket_unavailable',
                __('XPMarket price data is temporarily unavailable.', 'calorieapp-identity-bridge'),
                ['status' => 502]
            );
        }

        if ((int) wp_remote_retrieve_response_code($upstream) !== 200) {
            return new WP_Error(
                'calorieapp_xpmarket_response',
                __('XPMarket returned an unexpected response.', 'calorieapp-identity-bridge'),
                ['status' => 502]
            );
        }

        $payload = json_decode((string) wp_remote_retrieve_body($upstream), true);
        $data = self::sanitize_payload($payload);
        if ($data === null) {
            return new WP_Error(
                'calorieapp_xpmarket_payload',
                __('XPMarket returned incomplete price data.', 'calorieapp-identity-bridge'),
                ['status' => 502]
            );
        }

        set_transient(self::CACHE_KEY, $data, self::CACHE_TTL_SECONDS);

        return $this->response($data);
    }

    public static function sanitize_payload($payload): ?array {
        if (
            !is_array($payload)
            || empty($payload['success'])
            || !isset($payload['data'])
            || !is_array($payload['data'])
        ) {
            return null;
        }

        $source = $payload['data'];
        foreach (['code', 'issuer', 'title', 'logo'] as $key) {
            if (!isset($source[$key]) || !is_string($source[$key]) || trim($source[$key]) === '') {
                return null;
            }
        }

        if (
            $source['code'] !== 'Calorie'
            || $source['issuer'] !== 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY'
            || strpos($source['logo'], 'https://xpcdn.xpmarket.com/') !== 0
        ) {
            return null;
        }

        foreach (['price', 'priceUsd', 'marketcap', 'holders', 'rank'] as $key) {
            if (!isset($source[$key]) || !is_numeric($source[$key]) || (float) $source[$key] < 0) {
                return null;
            }
        }

        return [
            'source' => 'XPMarket',
            'token' => self::TOKEN,
            'token_url' => self::TOKEN_PAGE,
            'code' => sanitize_text_field($source['code']),
            'title' => sanitize_text_field($source['title']),
            'issuer' => sanitize_text_field($source['issuer']),
            'logo' => esc_url_raw($source['logo']),
            'price_xrp' => (float) $source['price'],
            'price_usd' => (float) $source['priceUsd'],
            'market_cap_usd' => (float) $source['marketcap'],
            'holders' => (int) $source['holders'],
            'rank' => (int) $source['rank'],
        ];
    }

    private function response(array $data): WP_REST_Response {
        $response = new WP_REST_Response(['success' => true, 'data' => $data], 200);
        $response->header('Cache-Control', 'public, max-age=' . self::CACHE_TTL_SECONDS);
        return $response;
    }
}

class Plugin {
    public const OPTION_KEY = 'calorieapp_identity_bridge_options';

    private static ?Plugin $instance = null;

    private Storage $storage;

    private RestApi $rest_api;

    private BrowserAuthorize $browser_authorize;

    private IntegratedLogin $integrated_login;

    private Admin $admin;

    private LegalFooterCompatibility $legal_footer_compatibility;

    private MarketWidget $market_widget;

    public static function instance(): Plugin {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct() {
        $this->storage = new Storage();
        $this->rest_api = new RestApi($this->storage);
        $this->browser_authorize = new BrowserAuthorize($this->rest_api);
        $this->integrated_login = new IntegratedLogin($this->rest_api);
        $this->admin = new Admin();
        $this->legal_footer_compatibility = new LegalFooterCompatibility();
        $this->market_widget = new MarketWidget();

        register_activation_hook(CALORIEAPP_IDENTITY_BRIDGE_FILE, [$this, 'activate']);

        add_action('plugins_loaded', [$this, 'init']);
    }

    public function init(): void {
        $this->storage->register_hooks();
        $this->rest_api->register_hooks();
        $this->browser_authorize->register_hooks();
        $this->integrated_login->register_hooks();
        $this->admin->register_hooks();
        $this->legal_footer_compatibility->register_hooks();
        $this->market_widget->register_hooks();
    }

    public function activate(): void {
        $this->storage->create_table();
        $this->seed_default_options();
    }

    private function seed_default_options(): void {
        $defaults = self::default_options();
        $existing = get_option(self::OPTION_KEY);

        if (!is_array($existing)) {
            add_option(self::OPTION_KEY, $defaults, '', false);
            return;
        }

        update_option(self::OPTION_KEY, wp_parse_args($existing, $defaults), false);
    }

    public static function default_options(): array {
        return [
            'callback_allowlist' => '',
            'default_callback_url' => '',
            'calorieapp_backend_url' => '',
            'bridge_secret' => '',
            'backend_client_id' => 'calorieapp-backend',
            'code_ttl_seconds' => 60,
        ];
    }

    public static function get_options(): array {
        $saved = get_option(self::OPTION_KEY, []);

        if (!is_array($saved)) {
            $saved = [];
        }

        return wp_parse_args($saved, self::default_options());
    }
}
