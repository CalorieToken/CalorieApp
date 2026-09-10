<?php
/**
 * Plugin Name: CalorieToken Site Style
 * Description: CalorieApp-huisstijl en gebundelde stap 3-verfijningen. Gedeelde huisstijl, appinformatie en paginakoppelingen; geaccepteerde Home-inhoud behouden.
 * Version: 1.4.1
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: ICTHendrikse
 * License: GPL-2.0-or-later
 * Text Domain: calorietoken-site-style
 */

namespace CalorieToken\SiteStyle;

if (!defined('ABSPATH')) { exit; }

final class Plugin {
    const VERSION = '1.4.1';

    private static function json_asset($name) {
        // Request-local cache only: plugin updates never need a persistent cache purge.
        static $cache = array();
        if (array_key_exists($name, $cache)) { return $cache[$name]; }
        $raw = @file_get_contents(__DIR__ . '/assets/' . $name . '.json');
        $value = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($value)) { $value = null; }
        if ($name === 'menu-data' && is_array($value)) {
            foreach (array('locales', 'appInformation', 'navigation', 'sharedLabels') as $key) {
                if (!isset($value[$key]) || !is_array($value[$key])) { $value = null; break; }
            }
        }
        $cache[$name] = $value;
        return $value;
    }

    // Reuse the installed handler. Never read API credentials or construct a transaction.
    public static function trustline_url() {
        if (!is_page(array(1205, 4205)) || !class_exists('Xummlogin_XUMM', false) ||
            !method_exists('Xummlogin_XUMM', 'xummlogin_prepare_trustline')) { return ''; }
        $handler = new \ReflectionMethod('Xummlogin_XUMM', 'xummlogin_prepare_trustline');
        if (!$handler->isPublic() || $handler->isAbstract()) { return ''; }
        if (get_option('xummlogin_trustline_issuer') !== 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY') { return ''; }
        $currency = get_option('xummlogin_trustline_currency');
        if (!in_array($currency, array('Calorie', '43616C6F72696500000000000000000000000000'), true)) { return ''; }
        $limit = get_option('xummlogin_trustline_limit');
        if (!is_numeric($limit) || !is_finite((float) $limit) || (float) $limit <= 0) { return ''; }
        return home_url('/index.php/trustline/?xl-trustline');
    }

    public static function discovery_assets($base) {
        $copy = self::json_asset('discovery-data');
        if (!is_array($copy)) { return; }
        wp_enqueue_style('calorietoken-discovery', $base . 'assets/discovery.css', array('calorietoken-app-information'), self::VERSION);
        $dependency = self::footer_only() ? 'calorietoken-app-information' : 'calorietoken-ready-languages';
        wp_enqueue_script('calorietoken-discovery', $base . 'assets/discovery.js', array($dependency), self::VERSION, true);
        wp_localize_script('calorietoken-discovery', 'CalorieTokenDiscovery', array(
            'copy' => $copy, 'page' => get_queried_object_id(),
            'trustlineURL' => self::trustline_url(),
            'appURL' => home_url('/index.php/calorieapp/'),
            'appLogo' => $base . 'assets/calorieapp-logo.svg',
            'testCopy' => is_page(7880) ? self::json_asset('testnet-data') : null,
        ));
        wp_enqueue_script('calorietoken-help', $base . 'assets/help.js', array('calorietoken-discovery'), self::VERSION, true);
        wp_localize_script('calorietoken-help', 'CalorieTokenHelp', array(
            'copy' => self::json_asset('help-data'),
            'page' => get_queried_object_id(),
        ));
        if (is_page(7880)) {
            wp_enqueue_script('calorietoken-testnet', $base . 'assets/testnet.js', array('calorietoken-discovery'), self::VERSION, true);
            wp_enqueue_script('calorietoken-display-runtime', $base . 'assets/display-language-runtime.js', array(), self::VERSION, true);
            wp_enqueue_script('calorietoken-app-integration', $base . 'assets/app-integration.js', array('calorietoken-testnet', 'calorietoken-display-runtime'), self::VERSION, true);
        }
    }

    public static function enabled() {
        if (is_admin() || is_feed() || is_embed() || is_front_page() ||
            is_page(array(1090, 8001)) ||
            (defined('REST_REQUEST') && REST_REQUEST) ||
            (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
            (function_exists('is_customize_preview') && is_customize_preview())) {
            return false;
        }
        foreach (array('brizy-edit', 'brizy-edit-iframe', 'brz-edit', 'brz-edit-iframe') as $key) {
            if (isset($_GET[$key])) { return false; }
        }
        return true;
    }

    public static function body_class($classes) {
        if (self::enabled()) { $classes[] = 'ctstyle-enabled'; }
        elseif (self::footer_only()) { $classes[] = 'ctstyle-footer-only'; }
        return $classes;
    }

    public static function footer_only() {
        if (!(is_front_page() || is_page(1090)) || is_page(8001) ||
            is_admin() || is_feed() || is_embed() ||
            (defined('REST_REQUEST') && REST_REQUEST) ||
            (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
            (function_exists('is_customize_preview') && is_customize_preview())) { return false; }
        foreach (array('preview', 'customize_changeset_uuid', 'brizy-edit', 'brizy-edit-iframe', 'brz-edit', 'brz-edit-iframe') as $key) {
            if (isset($_GET[$key])) { return false; }
        }
        return true;
    }

    public static function enqueue() {
        if (!self::enabled() && !self::footer_only()) { return; }
        $base = plugin_dir_url(__FILE__);
        wp_enqueue_style('calorietoken-site-style', $base . 'assets/style.css', array(), self::VERSION);
        wp_enqueue_script('calorietoken-site-style', $base . 'assets/style.js', array(), self::VERSION, true);
        wp_localize_script('calorietoken-site-style', 'CalorieTokenSiteStyle', array(
            'title' => is_singular() ? wp_strip_all_tags(get_the_title(get_queried_object_id())) : '',
            'headerImage' => content_url('/uploads/2024/01/achtergrondbannersitea1.png'),
            'titleImage' => content_url('/uploads/2022/10/kopje-banner3.png'),
            'paperImage' => content_url('/uploads/2021/12/Websiteachtergrond.png'),
            'footerOnly' => self::footer_only(),
        ));
        $copy = self::json_asset('menu-data');
        wp_enqueue_style('calorietoken-app-information', $base . 'assets/app-information.css', array('calorietoken-site-style'), self::VERSION);
        wp_enqueue_script('calorietoken-app-information', $base . 'assets/app-information.js', array('calorietoken-site-style'), self::VERSION, true);
        if (is_array($copy)) {
            $copy['appLogo'] = $base . 'assets/calorieapp-logo.svg';
            wp_localize_script('calorietoken-app-information', 'CalorieTokenAppInformation', array(
                'locales' => $copy['locales'], 'copy' => $copy['appInformation'],
                'appLogo' => $copy['appLogo'], 'appURL' => home_url('/index.php/calorieapp/'),
            ));
        }
        if (self::footer_only()) {
            wp_enqueue_script('calorietoken-navigation', $base . 'assets/navigation.js', array('calorietoken-app-information'), self::VERSION, true);
            if (is_array($copy)) { wp_localize_script('calorietoken-navigation', 'CalorieTokenSiteStyleMenu', array('locales' => $copy['locales'], 'navigation' => $copy['navigation'], 'sharedLabels' => $copy['sharedLabels'])); }
            self::discovery_assets($base); return;
        }
        wp_enqueue_style('calorietoken-menu-pages', $base . 'assets/menu-pages.css', array('calorietoken-site-style'), self::VERSION);
        wp_enqueue_script('calorietoken-menu-pages', $base . 'assets/menu-pages.js', array('calorietoken-app-information'), self::VERSION, true);
        if (is_array($copy)) {
            $copy['appLogo'] = $base . 'assets/calorieapp-logo.svg';
            wp_localize_script('calorietoken-menu-pages', 'CalorieTokenSiteStyleMenu', $copy);
        }
        wp_enqueue_script('calorietoken-ready-languages', $base . 'assets/ready-languages.js', array('calorietoken-menu-pages'), self::VERSION, true);
        if (is_page(1209)) {
            wp_enqueue_script('calorietoken-tokenomics', $base . 'assets/tokenomics.js', array('calorietoken-menu-pages'), self::VERSION, true);
        }
        if (is_page(1207)) {
            wp_enqueue_script('calorietoken-blog-timeline', $base . 'assets/blog-timeline.js', array('calorietoken-menu-pages'), self::VERSION, true);
        }
        wp_enqueue_script('calorietoken-navigation', $base . 'assets/navigation.js', array('calorietoken-menu-pages'), self::VERSION, true);
        self::discovery_assets($base);
    }

    public static function templates() {
        if (!self::enabled() && !self::footer_only()) { return; }
        // Templates are inert. Existing login DOM and its handlers are never copied.
        include __DIR__ . '/templates.php';
    }
}

add_filter('body_class', array(Plugin::class, 'body_class'));
add_action('wp_enqueue_scripts', array(Plugin::class, 'enqueue'), 99);
add_action('wp_footer', array(Plugin::class, 'templates'), 19);
