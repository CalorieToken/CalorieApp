<?php
/**
 * Plugin Name: CalorieToken Site Style
 * Description: CalorieApp-huisstijl en gebundelde stap 3-verfijningen. Gedeelde huisstijl, appinformatie en paginakoppelingen; geaccepteerde Home-inhoud behouden.
 * Version: 1.4.37
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: ICTHendrikse
 * License: GPL-2.0-or-later
 * Text Domain: calorietoken-site-style
 */

namespace CalorieToken\SiteStyle;

if (!defined('ABSPATH')) { exit; }

final class Plugin {
    const VERSION = '1.4.37';

    public static function presentation_preview() {
        if (is_admin() || !is_preview() || !is_singular('page') ||
            !current_user_can('edit_post', get_queried_object_id()) ||
            (defined('REST_REQUEST') && REST_REQUEST)) { return false; }
        foreach (array('customize_changeset_uuid', 'brizy-edit', 'brizy-edit-iframe', 'brz-edit', 'brz-edit-iframe') as $key) {
            if (isset($_GET[$key])) { return false; }
        }
        return true;
    }

    private static function presentation_assets($base, $preview = false) {
        // Only public menu labels/URLs. No account data or authentication settings.
        $links = array();
        $menu = wp_get_nav_menu_object('Hoofdmenu3');
        $items = $menu && !is_wp_error($menu) ? wp_get_nav_menu_items($menu) : false;
        foreach (is_array($items) ? $items : array() as $item) {
            if ($item->type === 'post_type' && get_post_status($item->object_id) !== 'publish') { continue; }
            $title = wp_strip_all_tags(html_entity_decode($item->title, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $links[] = array('title' => $title, 'url' => esc_url_raw($item->url));
        }
        wp_enqueue_style('calorietoken-presentation', $base . 'assets/presentation.css', $preview ? array() : array('calorietoken-refinements'), self::VERSION);
        wp_enqueue_script('calorietoken-presentation', $base . 'assets/presentation.js', $preview ? array() : array('calorietoken-refinements', 'calorietoken-content-language'), self::VERSION, true);
        wp_localize_script('calorietoken-presentation', 'CalorieTokenPresentation', array(
            'preview' => $preview, 'links' => $links, 'copy' => self::json_asset('presentation-data'),
            'paperImage' => content_url('/uploads/2021/12/Websiteachtergrond.png'),
            'headerImage' => content_url('/uploads/2024/01/achtergrondbannersitea1.png'),
            'titleImage' => content_url('/uploads/2022/10/kopje-banner3.png'),
        ));
    }

    public static function header_menu() {
        // The menu verified in the live Brizy header. Never fall through to an
        // unrelated menu or WordPress's automatic list of all public pages.
        $menu = wp_get_nav_menu_object('Hoofdmenu3');
        if (!$menu || is_wp_error($menu)) { return ''; }
        $html = wp_nav_menu(array(
            'menu' => $menu, 'container' => false, 'echo' => false,
            'fallback_cb' => false, 'items_wrap' => '<ul>%3$s</ul>',
        ));
        if (!is_string($html) || trim($html) === '') { return ''; }
        // Desktop and mobile share these links, without duplicate item IDs.
        $tags = new \WP_HTML_Tag_Processor($html);
        while ($tags->next_tag('LI')) {
            $id = $tags->get_attribute('id');
            if (is_string($id) && preg_match('/^menu-item-\d+$/', $id)) {
                $tags->remove_attribute('id');
            }
        }
        return $tags->get_updated_html();
    }

    public static function delegate_app_camera($html, $shortcode_tag = null) {
        if (!is_string($html) || ($shortcode_tag !== null && $shortcode_tag !== 'calorieapp_embed') ||
            !self::enabled() || !is_page(7880) || !class_exists('WP_HTML_Tag_Processor') ||
            !in_array(rtrim(home_url('/'), '/'), array('https://calorietoken.net', 'https://www.calorietoken.net'), true)) { return $html; }
        foreach (array_keys($_GET) as $key) { if ($key !== 'ui_lang') { return $html; } }
        $path = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', PHP_URL_PATH);
        if (!in_array($path, array('/index.php/calorieapp/', '/calorieapp/'), true)) { return $html; }

        // Set the permission in rendered HTML, before the iframe's first
        // navigation. A late DOM change cannot update an already-loaded policy.
        // Filter both fresh shortcode output and cached public Brizy content.
        $tags = new \WP_HTML_Tag_Processor($html);
        $found = false;
        while ($tags->next_tag('IFRAME')) {
            $classes = $tags->get_attribute('class');
            if (!is_string($classes) || !in_array('calorieapp-embed-frame', preg_split('/\s+/', trim($classes)), true)) { continue; }
            if ($found || $tags->get_attribute('title') !== 'CalorieApp') { return $html; }
            $found = true;
            foreach (array('srcdoc', 'sandbox', 'hidden', 'inert') as $attribute) {
                if ($tags->get_attribute($attribute) !== null) { return $html; }
            }
            $src = $tags->get_attribute('src');
            $url = is_string($src) ? parse_url($src) : false;
            if (!is_array($url) || !isset($url['scheme'], $url['host']) || $url['scheme'] !== 'https' ||
                isset($url['user']) || isset($url['pass']) || isset($url['port']) ||
                !in_array($url['host'], array('app.calorietoken.net', 'calorieapp-frontend.onrender.com'), true) ||
                !in_array(isset($url['path']) ? $url['path'] : '/', array('', '/'), true)) { return $html; }
            $permission = $tags->get_attribute('allow');
            if ($permission !== null && !is_string($permission)) { return $html; }
            $permission = $permission === null ? '' : $permission;
            // Preserve an operator's explicit camera restriction and every
            // other directive. Never grant the microphone or a wildcard origin.
            if (preg_match('/(?:^|;)\s*camera(?:\s|;|$)/i', $permission)) { return $html; }
            $tags->set_attribute('allow', $permission . (trim($permission) !== '' ? '; ' : '') . 'camera https://' . $url['host']);
        }
        return $found ? $tags->get_updated_html() : $html;
    }

    public static function retire_market_loader($html) {
        if (!is_string($html) || stripos($html, 'livecoinwatch.com') === false ||
            (!self::enabled() && !self::footer_only()) || !class_exists('WP_HTML_Tag_Processor') ||
            !in_array(strtolower((string) parse_url(home_url('/'), PHP_URL_HOST)), array('calorietoken.net', 'www.calorietoken.net'), true)) { return $html; }
        foreach (array_keys($_GET) as $key) { if (strpos($key, 'xl-') === 0) { return $html; } }
        // These installed bridge handles provide the site-wide XPMarket view.
        // Keep the legacy loader if that replacement is not being delivered.
        foreach (array('calorieapp-identity-bridge-layout', 'calorieapp-identity-bridge-site-polish') as $handle) {
            if (!wp_script_is($handle, 'enqueued') && !wp_script_is($handle, 'done')) { return $html; }
        }
        $tags = new \WP_HTML_Tag_Processor($html);
        while ($tags->next_tag('SCRIPT')) {
            $src = $tags->get_attribute('src');
            if (!is_string($src)) { continue; }
            $url = parse_url(strpos($src, '//') === 0 ? 'https:' . $src : $src);
            if (!is_array($url) || !isset($url['scheme'], $url['host'], $url['path']) ||
                !in_array(strtolower($url['scheme']), array('http', 'https'), true) || isset($url['user']) || isset($url['pass']) ||
                !in_array(strtolower($url['host']), array('livecoinwatch.com', 'www.livecoinwatch.com'), true) ||
                $url['path'] !== '/static/lcw-widget.js') { continue; }
            // Make the script inert before HTML reaches the browser. A distinct
            // data type also prevents consent tools from reactivating its body.
            $tags->remove_attribute('src');
            $tags->set_attribute('type', 'application/x-calorietoken-retired');
        }
        return $tags->get_updated_html();
    }

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
            'avatar' => $base . 'assets/caloriehelp-avatar.webp',
            'page' => get_queried_object_id(),
        ));
        wp_enqueue_style('calorietoken-refinements', $base . 'assets/refinements.css', array('calorietoken-discovery'), self::VERSION);
        wp_enqueue_script('calorietoken-refinements', $base . 'assets/refinements.js', array('calorietoken-help'), self::VERSION, true);
        $catalogue = self::json_asset('content-data');
        if (is_array($catalogue) && isset($catalogue['entries']) && is_array($catalogue['entries'])) {
            $page = get_queried_object_id();
            $entries = array_values(array_filter($catalogue['entries'], static function ($row) use ($page) {
                return is_array($row) && isset($row['pages']) && is_array($row['pages']) &&
                    (in_array('*', $row['pages'], true) || in_array($page, $row['pages'], true));
            }));
            wp_enqueue_script('calorietoken-content-language', $base . 'assets/content-language.js', array('calorietoken-refinements'), self::VERSION, true);
            wp_localize_script('calorietoken-content-language', 'CalorieTokenContentLanguage', array(
                'entries' => $entries, 'locales' => array_keys($copy),
            ));
        }
        self::presentation_assets($base);
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
            (function_exists('is_customize_preview') && is_customize_preview()) || is_preview()) {
            return false;
        }
        foreach (array('preview', 'customize_changeset_uuid', 'brizy-edit', 'brizy-edit-iframe', 'brz-edit', 'brz-edit-iframe') as $key) {
            if (isset($_GET[$key])) { return false; }
        }
        return true;
    }

    public static function body_class($classes) {
        if (self::enabled()) { $classes[] = 'ctstyle-enabled'; }
        elseif (self::footer_only()) { $classes[] = 'ctstyle-footer-only'; }
        elseif (self::presentation_preview()) { $classes[] = 'ctstyle-presentation-preview'; }
        return $classes;
    }

    public static function footer_only() {
        if (!(is_front_page() || is_page(1090)) || is_page(8001) ||
            is_admin() || is_feed() || is_embed() || is_preview() ||
            (defined('REST_REQUEST') && REST_REQUEST) ||
            (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
            (function_exists('is_customize_preview') && is_customize_preview())) { return false; }
        foreach (array('preview', 'customize_changeset_uuid', 'brizy-edit', 'brizy-edit-iframe', 'brz-edit', 'brz-edit-iframe') as $key) {
            if (isset($_GET[$key])) { return false; }
        }
        return true;
    }

    public static function enqueue() {
        if (self::presentation_preview()) {
            // Draft previews get presentation only, never public app/faucet/login runtimes.
            self::presentation_assets(plugin_dir_url(__FILE__), true);
            return;
        }
        if (!self::enabled() && !self::footer_only()) { return; }
        $base = plugin_dir_url(__FILE__);
        wp_enqueue_style('calorietoken-site-style', $base . 'assets/style.css', array(), self::VERSION);
        wp_enqueue_script('calorietoken-site-style', $base . 'assets/style.js', array(), self::VERSION, true);
        wp_localize_script('calorietoken-site-style', 'CalorieTokenSiteStyle', array(
            'title' => is_singular() ? wp_strip_all_tags(get_the_title(get_queried_object_id())) : '',
            'headerImage' => content_url('/uploads/2024/01/achtergrondbannersitea1.png'),
            'titleImage' => content_url('/uploads/2022/10/kopje-banner3.png'),
            'paperImage' => content_url('/uploads/2021/12/Websiteachtergrond.png'),
            'calLogo' => content_url('/uploads/2021/12/C-Logotranspa-1024x936.png'),
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

    public static function swft_consent_service($tags) {
        // Register the existing external frame with Complianz; never set user consent.
        if (!is_array($tags)) { return $tags; }
        foreach ($tags as $tag) {
            if (is_array($tag) && isset($tag['name']) && $tag['name'] === 'swft') { return $tags; }
        }
        $tags[] = array('name' => 'swft', 'category' => 'marketing',
            'urls' => array('defi.swft.pro'), 'enable_placeholder' => '0');
        return $tags;
    }

    public static function templates() {
        if (!self::enabled() && !self::footer_only()) { return; }
        // Templates are inert. Existing login DOM and its handlers are never copied.
        include __DIR__ . '/templates.php';
    }
}

add_filter('cmplz_known_script_tags', array(Plugin::class, 'swft_consent_service'));
add_filter('body_class', array(Plugin::class, 'body_class'));
add_action('wp_enqueue_scripts', array(Plugin::class, 'enqueue'), 99);
add_action('wp_footer', array(Plugin::class, 'templates'), 19);
add_filter('brizy_content', array(Plugin::class, 'delegate_app_camera'), 9998);
add_filter('the_content', array(Plugin::class, 'delegate_app_camera'), 9998);
add_filter('do_shortcode_tag', array(Plugin::class, 'delegate_app_camera'), 9998, 2);
add_filter('brizy_content', array(Plugin::class, 'retire_market_loader'), 9999);
add_filter('the_content', array(Plugin::class, 'retire_market_loader'), 9999);
add_filter('do_shortcode_tag', array(Plugin::class, 'retire_market_loader'), 9999);
require_once __DIR__ . '/public-pages.php';
require_once __DIR__ . '/review.php';
require_once __DIR__ . '/donations.php';
require_once __DIR__ . '/donation-ledger.php';
