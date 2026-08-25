<?php

namespace CalorieApp\IdentityBridge;

use WP_Error;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Browser-facing authorization endpoint.
 *
 * WordPress REST cookie authentication requires a REST nonce. XUMM Login
 * establishes a normal WordPress browser session, so the CalorieApp browser
 * handoff must run in the regular WordPress request lifecycle instead of a
 * REST request. The server-to-server exchange remains a REST endpoint.
 */
class BrowserAuthorize {
    public const QUERY_FLAG = 'calorieapp_authorize';

    private RestApi $rest_api;

    public function __construct(RestApi $rest_api) {
        $this->rest_api = $rest_api;
    }

    public function register_hooks(): void {
        add_action('template_redirect', [$this, 'maybe_authorize'], 0);
    }

    public function maybe_authorize(): void {
        $flag = isset($_GET[self::QUERY_FLAG])
            ? sanitize_text_field(wp_unslash((string) $_GET[self::QUERY_FLAG]))
            : '';

        if ($flag !== '1') {
            return;
        }

        nocache_headers();

        if (!is_user_logged_in()) {
            $this->render_error(
                new WP_Error('not_authenticated', 'WordPress user is not authenticated', ['status' => 401])
            );
        }

        $user_id = get_current_user_id();
        $state = isset($_GET['state'])
            ? trim(sanitize_text_field(wp_unslash((string) $_GET['state'])))
            : '';
        $callback_url = isset($_GET['callback_url'])
            ? trim(esc_url_raw(wp_unslash((string) $_GET['callback_url'])))
            : '';

        $result = $this->rest_api->authorize_current_user($user_id, $state, $callback_url);
        if ($result instanceof WP_Error) {
            $this->render_error($result);
        }

        wp_redirect((string) $result['redirect_url'], 302, 'CalorieApp Identity Bridge');
        exit;
    }

    private function render_error(WP_Error $error): void {
        $status = (int) ($error->get_error_data()['status'] ?? 400);
        if ($status < 400 || $status > 599) {
            $status = 400;
        }

        status_header($status);
        wp_die(
            esc_html($error->get_error_message()),
            esc_html__('CalorieApp authorization failed', 'calorieapp-identity-bridge'),
            ['response' => $status]
        );
    }
}
