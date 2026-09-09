<?php

namespace CalorieApp\IdentityBridge;

use WP_Error;
use WP_REST_Response;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Public CAL feed for the CalorieApp page's separate market card.
 *
 * WordPress fetches and caches only the small public widget payload from a
 * fixed endpoint. The browser uses the same-origin WordPress route.
 */
class MarketWidget {
    private const REST_NAMESPACE = 'calorieapp/v1';
    private const REST_ROUTE = '/xpmarket-widget';
    private const TOKEN = 'Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY';
    public const TOKEN_PAGE = 'https://xpmarket.com/token/' . self::TOKEN;
    private const API_URL = 'https://api.xpmarket.com/api/currency/widget?token=' . self::TOKEN;
    private const CACHE_KEY = 'calorieapp_xpmarket_widget_v1';
    private const ERROR_CACHE_KEY = 'calorieapp_xpmarket_widget_error_v1';
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
        if (!wp_script_is('calorieapp-identity-bridge-page-ending', 'registered')) {
            return;
        }

        wp_localize_script(
            'calorieapp-identity-bridge-page-ending',
            'calorieappPageEnding',
            [
                'xpMarketWidgetUrl' => rest_url(self::REST_NAMESPACE . self::REST_ROUTE),
                'xpMarketTokenUrl' => self::TOKEN_PAGE,
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

        if (get_transient(self::ERROR_CACHE_KEY)) {
            return $this->unavailable();
        }

        $upstream = wp_safe_remote_get(
            self::API_URL,
            [
                'headers' => ['Accept' => 'application/json'],
                'redirection' => 0,
                'limit_response_size' => 16384,
                'timeout' => 8,
                'user-agent' => 'CalorieToken WordPress XPMarket widget/1.0',
            ]
        );

        if (is_wp_error($upstream) || (int) wp_remote_retrieve_response_code($upstream) !== 200) {
            set_transient(self::ERROR_CACHE_KEY, true, MINUTE_IN_SECONDS);
            return $this->unavailable();
        }

        $payload = json_decode((string) wp_remote_retrieve_body($upstream), true);
        $data = self::sanitize_payload($payload);
        if ($data === null) {
            set_transient(self::ERROR_CACHE_KEY, true, MINUTE_IN_SECONDS);
            return $this->unavailable();
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
            if (!isset($source[$key]) || !is_numeric($source[$key]) || !is_finite((float) $source[$key]) || (float) $source[$key] < 0) {
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

    private function unavailable(): WP_Error {
        return new WP_Error(
            'calorieapp_xpmarket_unavailable',
            __('XPMarket price data is temporarily unavailable.', 'calorieapp-identity-bridge'),
            ['status' => 502]
        );
    }

    private function response(array $data): WP_REST_Response {
        $response = new WP_REST_Response(['success' => true, 'data' => $data], 200);
        // Reuse the origin transient, but do not add another browser/CDN
        // freshness window to an already cached market snapshot.
        $response->header('Cache-Control', 'public, max-age=0, must-revalidate');
        return $response;
    }
}
