<?php

namespace CalorieApp\IdentityBridge;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Restore only the CalorieApp WordPress page ending.
 * Keep this presentation separate from all sign-in and session controllers.
 */
class PageEnding {
    private bool $rendered = false;

    public function register_hooks(): void {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('wp_footer', [$this, 'render'], 5);
    }

    private function is_app_page(): bool {
        return !is_admin() && !is_feed() && !is_embed() && is_page('calorieapp');
    }

    public function enqueue_assets(): void {
        if (!$this->is_app_page()) {
            return;
        }

        $url = plugin_dir_url(CALORIEAPP_IDENTITY_BRIDGE_FILE) . 'assets/';
        $version = CALORIEAPP_IDENTITY_BRIDGE_VERSION;
        wp_enqueue_style('calorieapp-identity-bridge-page-ending', $url . 'calorieapp-page-ending.css', [], $version);
        wp_enqueue_script('calorieapp-identity-bridge-page-ending', $url . 'calorieapp-page-ending.js', [], $version, true);
    }

    public function render(): void {
        if ($this->rendered || !$this->is_app_page()) {
            return;
        }
        $this->rendered = true;
        $copyright_year = wp_date('Y');
        $social_links = [
            ['label' => 'Telegram', 'url' => 'https://t.me/+7YxaKdQYWNA0NDA0', 'icon' => 'telegram.svg'],
            ['label' => 'GitHub', 'url' => 'https://github.com/CalorieToken', 'icon' => 'github-square.svg'],
            ['label' => 'X', 'url' => 'https://twitter.com/CalorieToken', 'icon' => 'twitter.svg'],
            ['label' => 'Facebook', 'url' => 'https://www.facebook.com/CalorieToken-100422882407878', 'icon' => 'facebook.svg'],
            ['label' => 'YouTube', 'url' => 'https://www.youtube.com/channel/UCV_87rxST-cQOVu4W8nFZkA', 'icon' => 'youtube.svg'],
            ['label' => 'LinkedIn', 'url' => 'https://www.linkedin.com/company/calorie-token/', 'icon' => 'linkedin.svg'],
            ['label' => 'Instagram', 'url' => 'https://www.instagram.com/calorietoken/', 'icon' => 'instagram-square.svg'],
        ];
        ?>
        <div class="calorieapp-shared-page-ending" data-calorieapp-shared-page-ending>
            <aside class="calorieapp-page-market" aria-label="<?php echo esc_attr__('Calorie Token on XPMarket', 'calorieapp-identity-bridge'); ?>">
                <div class="calorieapp-xpmarket-widget" data-calorieapp-xpmarket-widget>
                    <a class="calorieapp-xpmarket-link" href="<?php echo esc_url(MarketWidget::TOKEN_PAGE); ?>" rel="noopener noreferrer">
                        <?php echo esc_html__('View CAL on XPMarket', 'calorieapp-identity-bridge'); ?>
                    </a>
                </div>
            </aside>
            <footer class="calorieapp-shared-footer">
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
        </div>
        <?php
    }
}
