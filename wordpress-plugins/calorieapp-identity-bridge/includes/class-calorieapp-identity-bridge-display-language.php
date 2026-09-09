<?php

namespace CalorieApp\IdentityBridge;

if (!defined('ABSPATH')) {
    exit;
}

/** Additive display preview. Never filters the authentication/WP locale. */
class DisplayLanguage {
    private bool $rendered = false;

    public function register_hooks(): void {
        add_action('wp_enqueue_scripts', [$this, 'enqueue']);
        add_action('wp_footer', [$this, 'render'], 6);
    }

    private function enabled(): bool {
        return defined('CALORIEAPP_DISPLAY_LANGUAGE_PREVIEW')
            && CALORIEAPP_DISPLAY_LANGUAGE_PREVIEW === true
            && !is_admin() && !is_feed() && !is_embed()
            && !(defined('REST_REQUEST') && REST_REQUEST)
            && !(function_exists('wp_doing_ajax') && wp_doing_ajax());
    }

    private function config(string $name): array {
        $path = dirname(__DIR__) . '/config/' . $name . '.json';
        if (!is_readable($path)) {
            return [];
        }
        $contents = file_get_contents($path);
        $decoded = is_string($contents) ? json_decode($contents, true) : null;
        return is_array($decoded) ? $decoded : [];
    }

    private function cms_preview(): array {
        // One observed public page only. Never add the sample to POST, editor,
        // draft/private/password-protected or unknown query contexts.
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET'
            || !is_page(6855) || is_preview()
            || get_post_status(6855) !== 'publish'
            || get_post_field('post_password', 6855, 'raw') !== ''
            || array_diff(array_keys($_GET), ['ui_lang'])
            || (isset($_GET['ui_lang']) && !is_string($_GET['ui_lang']))) {
            return [];
        }
        $catalogue = $this->config('cms-faq-preview');
        return ($catalogue['schema_version'] ?? null) === 1
            && ($catalogue['mode'] ?? '') === 'opt-in-development-preview'
            && ($catalogue['wordpress_id'] ?? null) === 6855
            ? $catalogue : [];
    }

    public function enqueue(): void {
        if (!$this->enabled()) {
            return;
        }
        $base = plugin_dir_url(CALORIEAPP_IDENTITY_BRIDGE_FILE) . 'assets/';
        $version = CALORIEAPP_IDENTITY_BRIDGE_VERSION;
        wp_enqueue_style('calorieapp-display-language', $base . 'calorieapp-display-language.css', [], $version);
        wp_enqueue_script('calorieapp-display-language-runtime', $base . 'calorieapp-display-language-runtime.js', [], $version, true);
        $dependencies = ['calorieapp-display-language-runtime'];
        $configuration = [
            'locales' => LocaleRegistry::all()['locales'],
            'initialLocale' => LocaleRegistry::resolve(get_locale()),
            'copy' => $this->config('display-language'),
            'information' => $this->config('app-information'),
            'navigation' => $this->config('navigation'),
        ];
        if (is_page(3243)) {
            $configuration['richlist'] = $this->config('richlist');
        }
        if (is_page(1205)) {
            $configuration['trustline'] = $this->config('trustline');
        }
        $cms_preview = $this->cms_preview();
        if ($cms_preview) {
            wp_enqueue_script('calorieapp-cms-language-preview', $base . 'calorieapp-cms-language-preview.js', [], $version, true);
            $dependencies[] = 'calorieapp-cms-language-preview';
            $configuration['cmsPreview'] = $cms_preview;
        }
        wp_enqueue_script('calorieapp-display-language', $base . 'calorieapp-display-language.js', $dependencies, $version, true);
        wp_add_inline_script('calorieapp-display-language',
            'window.calorieappDisplayLanguageConfig = ' . wp_json_encode($configuration,
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';', 'before');
    }

    public function render(): void {
        if (!$this->enabled() || $this->rendered) {
            return;
        }
        $this->rendered = true;
        ?>
        <div class="calorieapp-display-language" data-calorieapp-display-language hidden>
            <label for="calorieapp-display-language-select" data-calorieapp-language-label>Language</label>
            <select id="calorieapp-display-language-select" aria-describedby="calorieapp-display-language-note">
                <?php foreach (LocaleRegistry::all()['locales'] as $locale) : ?>
                    <option value="<?php echo esc_attr($locale['tag']); ?>" lang="<?php echo esc_attr($locale['tag']); ?>"><?php echo esc_html($locale['native_name']); ?></option>
                <?php endforeach; ?>
            </select>
            <p id="calorieapp-display-language-note" data-calorieapp-language-note></p>
        </div>
        <?php
    }
}
