<?php

namespace CalorieApp\IdentityBridge;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Rewrites obsolete legal footer labels left in cached Brizy output.
 *
 * This compatibility layer is intentionally limited to normal public HTML
 * responses. It does not change stored page, product, tokenomics, payment, or
 * authentication data and can be removed after the legacy Brizy caches have
 * been rebuilt.
 */
class LegalFooterCompatibility {
    private const LEGACY_OPERATOR_PATTERN = '/Chamber of Commerce KVK:\\s*[0-9]{8}/';
    private const CURRENT_OPERATOR = 'Operator: ICTHendrikse';
    private const LEGACY_COPYRIGHT = '© 2023 Calorie Token';
    private const CURRENT_COPYRIGHT = '© 2026 ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse';

    public function register_hooks(): void {
        add_action('template_redirect', [$this, 'start_output_buffer'], PHP_INT_MAX);
    }

    public function start_output_buffer(): void {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if (
            is_admin()
            || (defined('REST_REQUEST') && REST_REQUEST)
            || wp_doing_ajax()
            || !in_array($method, ['GET', 'HEAD'], true)
            || is_feed()
            || is_embed()
            || is_trackback()
        ) {
            return;
        }

        ob_start([self::class, 'replace_legacy_footer_html']);
    }

    public static function replace_legacy_footer_html(string $html): string {
        $html = preg_replace(
            self::LEGACY_OPERATOR_PATTERN,
            self::CURRENT_OPERATOR,
            $html
        ) ?? $html;

        return str_replace(self::LEGACY_COPYRIGHT, self::CURRENT_COPYRIGHT, $html);
    }
}
