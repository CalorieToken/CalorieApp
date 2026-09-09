<?php

namespace CalorieApp\IdentityBridge;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Share public page furniture without changing stored Brizy content.
 * Keep this presentation separate from all sign-in and session controllers.
 */
class PageEnding {
    private bool $rendered = false;
    private bool $shortcuts_rendered = false;

    public function register_hooks(): void {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('wp_footer', [$this, 'render_shortcuts'], 4);
        add_action('wp_footer', [$this, 'render'], 5);
    }

    private function is_public_html_request(): bool {
        return !is_admin() && !is_feed() && !is_embed()
            && !(defined('REST_REQUEST') && REST_REQUEST)
            && !(function_exists('wp_doing_ajax') && wp_doing_ajax());
    }

    private function is_app_page(): bool {
        return $this->is_public_html_request() && is_page('calorieapp');
    }

    public function enqueue_assets(): void {
        if (!$this->is_public_html_request()) {
            return;
        }

        $url = plugin_dir_url(CALORIEAPP_IDENTITY_BRIDGE_FILE) . 'assets/';
        $version = CALORIEAPP_IDENTITY_BRIDGE_VERSION;
        wp_enqueue_style('calorieapp-identity-bridge-page-ending', $url . 'calorieapp-page-ending.css', [], $version);
        wp_enqueue_script('calorieapp-identity-bridge-page-ending', $url . 'calorieapp-page-ending.js', [], $version, true);
        wp_enqueue_style('calorieapp-identity-bridge-site-polish', $url . 'calorieapp-site-polish.css', ['calorieapp-identity-bridge-page-ending'], $version);
        wp_enqueue_script('calorieapp-identity-bridge-site-polish', $url . 'calorieapp-site-polish.js', [], $version, true);
        // Trustline presentation receives a boolean only, never API credentials. The
        // installed XUMM plugin still owns payload creation and signing flow.
        // wp_localize_script stringifies scalars. Preserve a real JSON boolean
        // so the frontend's strict readiness check cannot accept a truthy string.
        // Blog copy is public and contains no stored visitor preference.
        $presentation = ['trustlineReady' => $this->cal_trustline_configured()];
        // Restrict the display helper to the observed public page. This marker
        // is independent of native signing readiness and carries no identity.
        if (is_page('trustline') && ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
            && !is_preview() && get_post_status(1205) === 'publish'
            && get_post_field('post_password', 1205, 'raw') === ''
            && !array_diff(array_keys($_GET), ['ui_lang'])
            && (!isset($_GET['ui_lang']) || is_string($_GET['ui_lang']))) {
            $presentation['trustlinePage'] = true;
        }
        if (is_page(1207) && ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
            && !is_preview() && get_post_status(1207) === 'publish'
            && get_post_field('post_password', 1207, 'raw') === '') {
            $path = dirname(__DIR__) . '/config/blog-x.json';
            $contents = is_readable($path) ? file_get_contents($path) : false;
            $catalogue = is_string($contents) ? json_decode($contents, true) : null;
            $presentation['blog'] = [
                'publicPage' => true,
                'initialLocale' => LocaleRegistry::resolve(get_locale()),
                'locales' => LocaleRegistry::all()['locales'],
                'copy' => is_array($catalogue) && isset($catalogue['translations'])
                    && is_array($catalogue['translations']) ? $catalogue['translations'] : [],
            ];
        }
        if (is_page(1209) && ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
            && !is_preview() && get_post_status(1209) === 'publish'
            && get_post_field('post_password', 1209, 'raw') === ''
            && !array_diff(array_keys($_GET), ['ui_lang'])
            && (!isset($_GET['ui_lang']) || is_string($_GET['ui_lang']))) {
            $path = dirname(__DIR__) . '/config/tokenomics.json';
            $contents = is_readable($path) ? file_get_contents($path) : false;
            $catalogue = is_string($contents) ? json_decode($contents, true) : null;
            $presentation['tokenomics'] = [
                'publicPage' => true,
                'initialLocale' => LocaleRegistry::resolve(get_locale()),
                'locales' => LocaleRegistry::all()['locales'],
                'copy' => is_array($catalogue) && isset($catalogue['translations'])
                    && is_array($catalogue['translations']) ? $catalogue['translations'] : [],
            ];
            wp_enqueue_style('calorieapp-tokenomics', $url . 'calorieapp-tokenomics.css', ['calorieapp-identity-bridge-site-polish'], $version);
            wp_enqueue_script('calorieapp-tokenomics', $url . 'calorieapp-tokenomics.js', ['calorieapp-identity-bridge-site-polish'], $version, true);
        }
        if (is_page(4205) && ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
            && !is_preview() && get_post_status(4205) === 'publish'
            && get_post_field('post_password', 4205, 'raw') === ''
            && !array_diff(array_keys($_GET), ['ui_lang'])
            && (!isset($_GET['ui_lang']) || is_string($_GET['ui_lang']))) {
            $path = dirname(__DIR__) . '/config/how-to-buy.json';
            $contents = is_readable($path) ? file_get_contents($path) : false;
            $catalogue = is_string($contents) ? json_decode($contents, true) : null;
            $presentation['buyGuide'] = [
                'publicPage' => true,
                'initialLocale' => LocaleRegistry::resolve(get_locale()),
                'locales' => LocaleRegistry::all()['locales'],
                'copy' => is_array($catalogue) && isset($catalogue['translations'])
                    && is_array($catalogue['translations']) ? $catalogue['translations'] : [],
            ];
            wp_enqueue_script('calorieapp-buy-guide-language', $url . 'calorieapp-buy-guide-language.js', ['calorieapp-identity-bridge-site-polish'], $version, true);
        }
        wp_add_inline_script(
            'calorieapp-identity-bridge-site-polish',
            'window.calorieappSitePolish = ' . wp_json_encode($presentation,
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';',
            'before'
        );
    }

    private function cal_trustline_configured(): bool {
        if (!is_page('trustline') || !class_exists('Xummlogin_XUMM', false)
            || !method_exists('Xummlogin_XUMM', 'xummlogin_prepare_trustline')) {
            return false;
        }
        if (get_option('xummlogin_trustline_issuer') !== 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY') {
            return false;
        }
        $currency = get_option('xummlogin_trustline_currency');
        if (!in_array($currency, ['Calorie', '43616C6F72696500000000000000000000000000'], true)) {
            return false;
        }
        $limit = get_option('xummlogin_trustline_limit');
        if (!is_string($limit) && !is_int($limit) && !is_float($limit)) {
            return false;
        }
        return preg_match('/^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/D', (string) $limit) === 1
            && is_finite((float) $limit) && (float) $limit > 0;
    }

    /** One compact stack replaces the page-specific fixed shortcut slots. */
    public function render_shortcuts(): void {
        if ($this->shortcuts_rendered || !$this->is_public_html_request()) {
            return;
        }
        $this->shortcuts_rendered = true;
        $glyphs = content_url('/plugins/brizy/public/editor-build/prod/editor/icons/glyph/');
        $logo = plugin_dir_url(CALORIEAPP_IDENTITY_BRIDGE_FILE) . 'assets/calorieapp-logo.svg';
        ?>
        <nav class="calorieapp-page-tools" data-calorieapp-fallback-shortcuts aria-label="<?php echo esc_attr__('Page shortcuts', 'calorieapp-identity-bridge'); ?>" hidden>
            <div class="calorieapp-page-tool-position calorieapp-page-tool-position-home" data-calorieapp-shortcut="home" hidden>
                <a class="calorieapp-page-tool" href="<?php echo esc_url(home_url('/')); ?>" aria-label="<?php echo esc_attr__('Go to Home', 'calorieapp-identity-bridge'); ?>" title="Home">
                    <svg class="calorieapp-page-tool-icon" aria-hidden="true" focusable="false"><use href="<?php echo esc_url($glyphs . 'home-minimal.svg#nc_icon'); ?>"></use></svg>
                </a>
            </div>
            <div class="calorieapp-page-tool-position calorieapp-page-tool-position-app" data-calorieapp-shortcut="app" hidden>
                <a class="calorieapp-page-tool" href="<?php echo esc_url(home_url('/index.php/calorieapp/')); ?>" aria-label="<?php echo esc_attr__('Open CalorieApp', 'calorieapp-identity-bridge'); ?>" title="CalorieApp">
                    <img class="calorieapp-page-tool-icon" src="<?php echo esc_url($logo); ?>" alt="" aria-hidden="true" width="48" height="48">
                </a>
            </div>
            <div class="calorieapp-page-tool-position calorieapp-page-tool-position-bottom" data-calorieapp-shortcut="bottom" hidden>
                <a class="calorieapp-page-tool" href="#" data-calorieapp-scroll="bottom" aria-label="<?php echo esc_attr__('Go to bottom', 'calorieapp-identity-bridge'); ?>" title="<?php echo esc_attr__('Go to bottom', 'calorieapp-identity-bridge'); ?>">
                    <svg class="calorieapp-page-tool-icon" aria-hidden="true" focusable="false"><use href="<?php echo esc_url($glyphs . 'square-download.svg#nc_icon'); ?>"></use></svg>
                </a>
            </div>
            <div class="calorieapp-page-tool-position calorieapp-page-tool-position-top" data-calorieapp-shortcut="top" hidden>
                <a class="calorieapp-page-tool" href="#" data-calorieapp-scroll="top" aria-label="<?php echo esc_attr__('Back to top', 'calorieapp-identity-bridge'); ?>" title="<?php echo esc_attr__('Back to top', 'calorieapp-identity-bridge'); ?>">
                    <svg class="calorieapp-page-tool-icon" aria-hidden="true" focusable="false"><use href="<?php echo esc_url($glyphs . 'square-upload.svg#nc_icon'); ?>"></use></svg>
                </a>
            </div>
        </nav>
        <?php
    }

    public function render(): void {
        if ($this->rendered || !$this->is_public_html_request()) {
            return;
        }
        $this->rendered = true;
        $app_page = $this->is_app_page();
        // Use the page's WordPress locale, never a visitor's private profile or
        // Accept-Language header: this component is safe in shared page caches.
        $locale = LocaleRegistry::resolve(get_locale());
        $copy = $this->app_information_copy($locale);
        $locale = $copy['locale'];
        $logo = plugin_dir_url(CALORIEAPP_IDENTITY_BRIDGE_FILE) . 'assets/calorieapp-logo.svg';
        $copyright_year = wp_date('Y');
        $social_links = [
            ['label' => 'Telegram', 'url' => 'https://t.me/+7YxaKdQYWNA0NDA0', 'icon' => 'telegram.svg'],
            ['label' => 'GitHub', 'url' => 'https://github.com/CalorieToken', 'icon' => 'github-square.svg'],
            ['label' => 'X', 'url' => 'https://x.com/CalorieToken', 'icon' => 'twitter.svg'],
            ['label' => 'Facebook', 'url' => 'https://www.facebook.com/CalorieToken-100422882407878', 'icon' => 'facebook.svg'],
            ['label' => 'YouTube', 'url' => 'https://www.youtube.com/channel/UCV_87rxST-cQOVu4W8nFZkA', 'icon' => 'youtube.svg'],
            ['label' => 'LinkedIn', 'url' => 'https://www.linkedin.com/company/calorie-token/', 'icon' => 'linkedin.svg'],
            ['label' => 'Instagram', 'url' => 'https://www.instagram.com/calorietoken/', 'icon' => 'instagram-square.svg'],
        ];
        ?>
        <div class="calorieapp-shared-page-ending" data-calorieapp-shared-page-ending data-calorieapp-page="<?php echo $app_page ? 'app' : 'site'; ?>">
            <aside class="calorieapp-app-info" data-calorieapp-app-info lang="<?php echo esc_attr($locale); ?>" dir="<?php echo esc_attr(LocaleRegistry::direction($locale)); ?>" aria-labelledby="calorieapp-app-info-title">
                <img src="<?php echo esc_url($logo); ?>" alt="" width="64" height="64" loading="lazy">
                <div>
                    <h2 id="calorieapp-app-info-title">CalorieApp</h2>
                    <p><?php echo esc_html($copy['description']); ?></p>
                </div>
                <?php if ($app_page) : ?>
                    <p class="calorieapp-app-info-current"><?php echo esc_html($copy['on_page']); ?></p>
                <?php else : ?>
                    <a class="calorieapp-app-info-link" href="<?php echo esc_url(home_url('/index.php/calorieapp/')); ?>"><?php echo esc_html($copy['action']); ?></a>
                <?php endif; ?>
            </aside>
            <?php if (is_singular()) : ?>
            <aside class="calorieapp-page-market calorieapp-sitewide-market" data-calorieapp-sitewide-market aria-label="<?php echo esc_attr__('Calorie Token on XPMarket', 'calorieapp-identity-bridge'); ?>"<?php echo $app_page ? '' : ' hidden'; ?>>
                <div class="calorieapp-xpmarket-widget" data-calorieapp-xpmarket-widget>
                    <a class="calorieapp-xpmarket-link" href="<?php echo esc_url(MarketWidget::TOKEN_PAGE); ?>" rel="noopener noreferrer">
                        <?php echo esc_html__('View CAL on XPMarket', 'calorieapp-identity-bridge'); ?>
                    </a>
                </div>
            </aside>
            <?php endif; ?>
            <footer class="calorieapp-shared-footer"<?php echo $app_page ? '' : ' hidden'; ?>>
                <nav
                    class="calorieapp-shared-socials"
                    aria-label="<?php echo esc_attr__('CalorieToken social channels', 'calorieapp-identity-bridge'); ?>"
                    data-calorieapp-social-carousel
                >
                    <button
                        type="button"
                        class="calorieapp-shared-social-arrow"
                        data-calorieapp-carousel-direction="-1"
                        aria-label="<?php echo esc_attr__('Previous social channel', 'calorieapp-identity-bridge'); ?>"
                    >&#8249;</button>
                    <div class="calorieapp-shared-social-window">
                        <div class="calorieapp-shared-social-track">
                            <?php foreach ($social_links as $social) : ?>
                                <a
                                    class="calorieapp-shared-social"
                                    href="<?php echo esc_url($social['url']); ?>"
                                    rel="noopener"
                                    aria-label="<?php echo esc_attr($social['label']); ?>"
                                    title="<?php echo esc_attr($social['label']); ?>"
                                >
                                    <svg class="calorieapp-shared-social-icon" aria-hidden="true" focusable="false">
                                        <use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/fa/' . $social['icon'] . '#fa_icon')); ?>"></use>
                                    </svg>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="calorieapp-shared-social-arrow"
                        data-calorieapp-carousel-direction="1"
                        aria-label="<?php echo esc_attr__('Next social channel', 'calorieapp-identity-bridge'); ?>"
                    >&#8250;</button>
                </nav>
                <div class="calorieapp-shared-legal">
                    <p><?php echo esc_html__('Calorie aims to be the world’s food token', 'calorieapp-identity-bridge'); ?></p>
                    <p><?php echo esc_html__('Operator: ICTHendrikse · KVK 73774693', 'calorieapp-identity-bridge'); ?></p>
                    <p>
                        <?php
                        printf(
                            esc_html__('© %s ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse', 'calorieapp-identity-bridge'),
                            esc_html($copyright_year)
                        );
                        ?>
                    </p>
                    <p class="calorieapp-shared-legal-links">
                        <a href="<?php echo esc_url(home_url('/index.php/privacy-policy/')); ?>"><?php echo esc_html__('Privacy Policy', 'calorieapp-identity-bridge'); ?></a>
                        <a href="<?php echo esc_url(home_url('/index.php/terms-conditions/')); ?>"><?php echo esc_html__('Terms & Conditions', 'calorieapp-identity-bridge'); ?></a>
                    </p>
                </div>
            </footer>
            <?php if (!$app_page) : ?>
                <noscript>
                    <nav class="calorieapp-footer-no-script calorieapp-shared-legal-links" aria-label="<?php echo esc_attr__('Legal information', 'calorieapp-identity-bridge'); ?>">
                        <a href="<?php echo esc_url(home_url('/index.php/privacy-policy/')); ?>"><?php echo esc_html__('Privacy Policy', 'calorieapp-identity-bridge'); ?></a>
                        <a href="<?php echo esc_url(home_url('/index.php/terms-conditions/')); ?>"><?php echo esc_html__('Terms & Conditions', 'calorieapp-identity-bridge'); ?></a>
                    </nav>
                </noscript>
            <?php endif; ?>
        </div>
        <?php
    }

    private function app_information_copy(string $locale): array {
        $fallback = [
            'description' => 'Find food products, explore nutrition and keep your own food diary.',
            'action' => 'Open CalorieApp',
            'on_page' => 'CalorieApp is available above.',
        ];
        $path = dirname(__DIR__) . '/config/app-information.json';
        $contents = is_readable($path) ? file_get_contents($path) : false;
        $decoded = is_string($contents) ? json_decode($contents, true) : null;
        $copy = is_array($decoded) ? ($decoded[$locale] ?? null) : null;
        foreach ($fallback as $key => $value) {
            if (!is_array($copy) || !isset($copy[$key]) || !is_string($copy[$key]) || trim($copy[$key]) === '') {
                return $fallback + ['locale' => 'en'];
            }
        }
        return array_intersect_key($copy, $fallback) + ['locale' => $locale];
    }
}
