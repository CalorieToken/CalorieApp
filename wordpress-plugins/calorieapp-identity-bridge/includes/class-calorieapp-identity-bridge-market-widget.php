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
    private const CACHE_KEY = 'calorieapp_xpmarket_widget_v3';
    private const LAST_GOOD_CACHE_KEY = 'calorieapp_xpmarket_widget_last_good_v1';
    private const ERROR_CACHE_KEY = 'calorieapp_xpmarket_widget_error_v2';
    private const CACHE_TTL_SECONDS = 5 * MINUTE_IN_SECONDS;
    private const LAST_GOOD_TTL_SECONDS = HOUR_IN_SECONDS;

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
        $cached = self::sanitize_snapshot(
            get_transient(self::CACHE_KEY),
            self::CACHE_TTL_SECONDS
        );
        if ($cached !== null) {
            return $this->response($cached, 'fresh');
        }

        $last_good = self::sanitize_snapshot(
            get_transient(self::LAST_GOOD_CACHE_KEY),
            self::LAST_GOOD_TTL_SECONDS
        );
        if (get_transient(self::ERROR_CACHE_KEY)) {
            return $this->last_good_or_unavailable($last_good);
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
            return $this->last_good_or_unavailable($last_good);
        }

        $payload = json_decode((string) wp_remote_retrieve_body($upstream), true);
        $data = self::sanitize_payload($payload);
        if ($data === null) {
            set_transient(self::ERROR_CACHE_KEY, true, MINUTE_IN_SECONDS);
            return $this->last_good_or_unavailable($last_good);
        }

        $snapshot = ['data' => $data, 'fetched_at' => time()];
        set_transient(self::CACHE_KEY, $snapshot, self::CACHE_TTL_SECONDS);
        set_transient(self::LAST_GOOD_CACHE_KEY, $snapshot, self::LAST_GOOD_TTL_SECONDS);
        delete_transient(self::ERROR_CACHE_KEY);

        return $this->response($snapshot, 'fresh');
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

        $counts = [];
        foreach (['holders', 'rank'] as $key) {
            // Use a portable integer range before casting, including on
            // 32-bit PHP. Fractional or overflowing counts are invalid data.
            if (is_float($source[$key]) && floor($source[$key]) !== $source[$key]) {
                return null;
            }
            $counts[$key] = filter_var($source[$key], FILTER_VALIDATE_INT, [
                'options' => ['min_range' => 0, 'max_range' => 2147483647],
            ]);
            if ($counts[$key] === false) {
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
            'holders' => $counts['holders'],
            'rank' => $counts['rank'],
        ];
    }

    private static function sanitize_snapshot($snapshot, int $maximum_age): ?array {
        if (
            !is_array($snapshot)
            || !isset($snapshot['data'], $snapshot['fetched_at'])
            || !is_array($snapshot['data'])
            || !is_int($snapshot['fetched_at'])
            || $snapshot['fetched_at'] <= 0
            || $snapshot['fetched_at'] > time() + MINUTE_IN_SECONDS
            || time() - $snapshot['fetched_at'] > $maximum_age
        ) {
            return null;
        }

        $cached = $snapshot['data'];
        if (
            ($cached['source'] ?? null) !== 'XPMarket'
            || ($cached['token'] ?? null) !== self::TOKEN
            || ($cached['token_url'] ?? null) !== self::TOKEN_PAGE
        ) {
            return null;
        }

        $data = self::sanitize_payload([
            'success' => true,
            'data' => [
                'code' => $cached['code'] ?? null,
                'issuer' => $cached['issuer'] ?? null,
                'title' => $cached['title'] ?? null,
                'logo' => $cached['logo'] ?? null,
                'price' => $cached['price_xrp'] ?? null,
                'priceUsd' => $cached['price_usd'] ?? null,
                'marketcap' => $cached['market_cap_usd'] ?? null,
                'holders' => $cached['holders'] ?? null,
                'rank' => $cached['rank'] ?? null,
            ],
        ]);
        if ($data === null) {
            return null;
        }

        return ['data' => $data, 'fetched_at' => $snapshot['fetched_at']];
    }

    private function unavailable(): WP_Error {
        return new WP_Error(
            'calorieapp_xpmarket_unavailable',
            __('XPMarket price data is temporarily unavailable.', 'calorieapp-identity-bridge'),
            ['status' => 502]
        );
    }

    /**
     * @return WP_REST_Response|WP_Error
     */
    private function last_good_or_unavailable(?array $last_good) {
        return $last_good === null
            ? $this->unavailable()
            : $this->response($last_good, 'last_known');
    }

    private function response(array $snapshot, string $state): WP_REST_Response {
        $response = new WP_REST_Response([
            'success' => true,
            'data' => $snapshot['data'],
            'meta' => [
                'snapshot' => $state,
                'fetched_at' => $snapshot['fetched_at'],
            ],
        ], 200);
        // Reuse the origin transient, but do not add another browser/CDN
        // freshness window to an already cached market snapshot.
        $response->header(
            'Cache-Control',
            $state === 'last_known'
                ? 'no-store'
                : 'public, max-age=0, must-revalidate'
        );
        return $response;
    }
}
