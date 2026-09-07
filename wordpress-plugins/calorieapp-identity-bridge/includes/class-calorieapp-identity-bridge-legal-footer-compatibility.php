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
    private const FLEXIBLE_SPACE = '(?:\\s|&nbsp;|&#160;|\\x{00A0})*';
    private const LEGACY_OPERATOR_PATTERNS = [
        '/Chamber' . self::FLEXIBLE_SPACE . 'of' . self::FLEXIBLE_SPACE . 'Commerce' . self::FLEXIBLE_SPACE . 'KVK' . self::FLEXIBLE_SPACE . ':' . self::FLEXIBLE_SPACE . '[0-9]{8}/iu',
        '/Calorie' . self::FLEXIBLE_SPACE . 'Token' . self::FLEXIBLE_SPACE . '(?:•|·|&bull;|&middot;)' . self::FLEXIBLE_SPACE . 'KvK' . self::FLEXIBLE_SPACE . ':?' . self::FLEXIBLE_SPACE . '[0-9]{8}/iu',
        '/Operator:' . self::FLEXIBLE_SPACE . 'ICTHendrikse' . self::FLEXIBLE_SPACE . '(?:•|·|&bull;|&middot;)' . self::FLEXIBLE_SPACE . 'KvK' . self::FLEXIBLE_SPACE . ':?' . self::FLEXIBLE_SPACE . '73774693/iu',
        '/(?<!Operator: )ICTHendrikse' . self::FLEXIBLE_SPACE . '(?:•|·|&bull;|&middot;)' . self::FLEXIBLE_SPACE . 'KvK' . self::FLEXIBLE_SPACE . ':?' . self::FLEXIBLE_SPACE . '73774693/iu',
        '/Operator:' . self::FLEXIBLE_SPACE . 'ICTHendrikse(?!' . self::FLEXIBLE_SPACE . '(?:•|·|&bull;|&middot;)' . self::FLEXIBLE_SPACE . 'KVK)/iu',
    ];
    private const CURRENT_OPERATOR = 'Operator: ICTHendrikse · KVK 73774693';
    private const LEGACY_COPYRIGHT_PATTERNS = [
        '/(?:©|&copy;)' . self::FLEXIBLE_SPACE . '2023' . self::FLEXIBLE_SPACE . 'Calorie' . self::FLEXIBLE_SPACE . 'Token/iu',
        '/(?:©|&copy;)' . self::FLEXIBLE_SPACE . '2026' . self::FLEXIBLE_SPACE . 'CalorieToken(?!®)/iu',
    ];
    private const CURRENT_COPYRIGHT = '© 2026 ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse';
    private const LEGACY_TAGLINE_PATTERN = '/Calorie' . self::FLEXIBLE_SPACE . 'aims' . self::FLEXIBLE_SPACE . 'to' . self::FLEXIBLE_SPACE . 'be' . self::FLEXIBLE_SPACE . 'the' . self::FLEXIBLE_SPACE . 'World(?:\'|’|&apos;|&rsquo;|&#39;|&#8217;)' . self::FLEXIBLE_SPACE . 's' . self::FLEXIBLE_SPACE . 'food' . self::FLEXIBLE_SPACE . 'token/iu';
    private const CURRENT_TAGLINE = 'Calorie aims to be the world’s food token';

    public function register_hooks(): void {
        add_action('template_redirect', [$this, 'start_output_buffer'], PHP_INT_MAX);
    }

    public function start_output_buffer(): void {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        // The donation product/cart may render their normal page after POST.
        // Correct that HTML footer too, without touching checkout, AJAX,
        // REST, authentication, or the underlying donation transaction.
        $cart_page_post = $method === 'POST'
            && ((function_exists('is_cart') && is_cart())
                || (function_exists('is_product') && is_product()));

        if (
            is_admin()
            || (defined('REST_REQUEST') && REST_REQUEST)
            || wp_doing_ajax()
            || (!in_array($method, ['GET', 'HEAD'], true) && !$cart_page_post)
            || is_feed()
            || is_embed()
            || is_trackback()
        ) {
            return;
        }

        ob_start([self::class, $cart_page_post ? 'replace_cart_page_footer_html' : 'replace_legacy_footer_html']);
    }

    public static function replace_cart_page_footer_html(string $html): string {
        // Only full page documents: leave JSON, fragments and redirect bodies
        // untouched even if a third-party handler runs on a product URL.
        if (!preg_match('/^\s*(?:<!doctype\s+html\b|<html\b)/i', $html)) {
            return $html;
        }
        foreach (headers_list() as $header) {
            if (stripos($header, 'Content-Type:') === 0 && stripos($header, 'text/html') === false) {
                return $html;
            }
        }
        return self::replace_legacy_footer_html($html);
    }

    public static function replace_legacy_footer_html(string $html): string {
        foreach (self::LEGACY_OPERATOR_PATTERNS as $pattern) {
            $html = preg_replace($pattern, self::CURRENT_OPERATOR, $html) ?? $html;
        }

        foreach (self::LEGACY_COPYRIGHT_PATTERNS as $pattern) {
            $html = preg_replace($pattern, self::CURRENT_COPYRIGHT, $html) ?? $html;
        }

        return preg_replace(
            self::LEGACY_TAGLINE_PATTERN,
            self::CURRENT_TAGLINE,
            $html
        ) ?? $html;
    }
}
