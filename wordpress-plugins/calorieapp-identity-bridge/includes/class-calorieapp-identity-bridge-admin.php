<?php

namespace CalorieApp\IdentityBridge;

if (!defined('ABSPATH')) {
    exit;
}

class Admin {

    private const PAGE_SLUG = 'calorieapp-identity-bridge';

    public function register_hooks(): void {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }

    public function register_menu(): void {
        add_options_page(
            'CalorieApp Identity Bridge',
            'CalorieApp Identity Bridge',
            'manage_options',
            self::PAGE_SLUG,
            [$this, 'render_page']
        );
    }

    public function register_settings(): void {
        register_setting(
            'calorieapp_identity_bridge',
            Plugin::OPTION_KEY,
            [
                'type' => 'array',
                'sanitize_callback' => [$this, 'sanitize_options'],
                'default' => Plugin::default_options(),
                'show_in_rest' => false,
            ]
        );

        add_settings_section(
            'calorieapp_identity_bridge_main',
            'Bridge Configuration',
            function (): void {
                echo '<p>Configure callback allowlist, backend URL, and server-to-server secret.</p>';
            },
            self::PAGE_SLUG
        );

        add_settings_field(
            'callback_allowlist',
            'Callback URL allowlist',
            [$this, 'render_callback_allowlist_field'],
            self::PAGE_SLUG,
            'calorieapp_identity_bridge_main'
        );

        add_settings_field(
            'default_callback_url',
            'Default callback URL',
            [$this, 'render_default_callback_url_field'],
            self::PAGE_SLUG,
            'calorieapp_identity_bridge_main'
        );

        add_settings_field(
            'calorieapp_backend_url',
            'CalorieApp backend URL',
            [$this, 'render_backend_url_field'],
            self::PAGE_SLUG,
            'calorieapp_identity_bridge_main'
        );

        add_settings_field(
            'backend_client_id',
            'Backend client ID',
            [$this, 'render_client_id_field'],
            self::PAGE_SLUG,
            'calorieapp_identity_bridge_main'
        );

        add_settings_field(
            'bridge_secret',
            'Bridge secret',
            [$this, 'render_bridge_secret_field'],
            self::PAGE_SLUG,
            'calorieapp_identity_bridge_main'
        );

        add_settings_field(
            'code_ttl_seconds',
            'Code TTL (seconds)',
            [$this, 'render_ttl_field'],
            self::PAGE_SLUG,
            'calorieapp_identity_bridge_main'
        );
    }

    public function sanitize_options($input): array {
        $existing = Plugin::get_options();

        if (!is_array($input)) {
            return $existing;
        }

        $allowlist_lines = [];
        $raw_allowlist = (string) ($input['callback_allowlist'] ?? '');

        foreach (preg_split('/\R+/', $raw_allowlist) as $line) {
            $line = trim((string) $line);

            if ($line === '') {
                continue;
            }

            $line = $this->sanitize_bridge_url($line);

            if ($line !== '') {
                $allowlist_lines[] = $line;
            }
        }

        $default_callback_url = $this->sanitize_bridge_url(
            (string) ($input['default_callback_url'] ?? '')
        );

        $backend_url = $this->sanitize_bridge_url(
            (string) ($input['calorieapp_backend_url'] ?? '')
        );

        $backend_client_id = sanitize_text_field(
            (string) ($input['backend_client_id'] ?? '')
        );

        $ttl = (int) ($input['code_ttl_seconds'] ?? 60);
        $ttl = max(10, min(300, $ttl));

        $bridge_secret = (string) ($input['bridge_secret'] ?? '');

        if ($bridge_secret === '') {
            $bridge_secret = (string) $existing['bridge_secret'];
        }

        $bridge_secret = trim($bridge_secret);

        $sanitized = [
            'callback_allowlist' => implode("\n", $allowlist_lines),
            'default_callback_url' => $default_callback_url,
            'calorieapp_backend_url' => $backend_url,
            'backend_client_id' => $backend_client_id,
            'bridge_secret' => $bridge_secret,
            'code_ttl_seconds' => $ttl,
        ];

        if (
            !$this->default_callback_in_allowlist(
                $sanitized['default_callback_url'],
                $sanitized['callback_allowlist']
            )
        ) {
            add_settings_error(
                Plugin::OPTION_KEY,
                'default_callback_not_allowlisted',
                'Default callback URL must also be present in the callback allowlist.'
            );

            return $existing;
        }

        return $sanitized;
    }

    public function render_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        echo '<div class="wrap">';
        echo '<h1>CalorieApp Identity Bridge</h1>';
        echo '<form method="post" action="options.php">';

        settings_fields('calorieapp_identity_bridge');
        do_settings_sections(self::PAGE_SLUG);
        submit_button('Save settings');

        echo '</form>';
        echo '</div>';
    }

    public function render_callback_allowlist_field(): void {
        $options = Plugin::get_options();
        $value = (string) $options['callback_allowlist'];

        echo '<textarea name="' .
            esc_attr(Plugin::OPTION_KEY) .
            '[callback_allowlist]" rows="4" cols="80" class="large-text code">' .
            esc_textarea($value) .
            '</textarea>';

        echo '<p class="description">One HTTPS callback URL per line. Loopback HTTP URLs are allowed for local staging only.</p>';
    }

    public function render_default_callback_url_field(): void {
        $options = Plugin::get_options();
        $value = (string) $options['default_callback_url'];

        echo '<input type="url" class="regular-text code" name="' .
            esc_attr(Plugin::OPTION_KEY) .
            '[default_callback_url]" value="' .
            esc_attr($value) .
            '" />';
    }

    public function render_backend_url_field(): void {
        $options = Plugin::get_options();
        $value = (string) $options['calorieapp_backend_url'];

        echo '<input type="url" class="regular-text code" name="' .
            esc_attr(Plugin::OPTION_KEY) .
            '[calorieapp_backend_url]" value="' .
            esc_attr($value) .
            '" />';
    }

    public function render_client_id_field(): void {
        $options = Plugin::get_options();
        $value = (string) $options['backend_client_id'];

        echo '<input type="text" class="regular-text code" name="' .
            esc_attr(Plugin::OPTION_KEY) .
            '[backend_client_id]" value="' .
            esc_attr($value) .
            '" />';
    }

    public function render_bridge_secret_field(): void {
        $options = Plugin::get_options();
        $is_configured = ((string) $options['bridge_secret']) !== '';

        $placeholder = $is_configured
            ? 'Configured (leave blank to keep unchanged)'
            : '';

        echo '<input type="password" class="regular-text code" autocomplete="new-password" name="' .
            esc_attr(Plugin::OPTION_KEY) .
            '[bridge_secret]" value="" placeholder="' .
            esc_attr($placeholder) .
            '" />';

        echo '<p class="description">Secret is never returned by REST endpoints and is validated server-to-server only.</p>';
    }

    public function render_ttl_field(): void {
        $options = Plugin::get_options();
        $value = (int) $options['code_ttl_seconds'];

        echo '<input type="number" min="10" max="300" step="1" class="small-text" name="' .
            esc_attr(Plugin::OPTION_KEY) .
            '[code_ttl_seconds]" value="' .
            esc_attr((string) $value) .
            '" />';
    }

    private function sanitize_bridge_url(string $value): string {
        $value = trim($value);

        if ($value === '') {
            return '';
        }

        $https = esc_url_raw($value, ['https']);

        if ($https !== '') {
            return $https;
        }

        $parts = wp_parse_url($value);

        if (!is_array($parts)) {
            return '';
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        $is_loopback = in_array(
            $host,
            ['localhost', '127.0.0.1', '::1'],
            true
        );

        if ($scheme === 'http' && $is_loopback) {
            return esc_url_raw($value, ['http']);
        }

        return '';
    }

    private function default_callback_in_allowlist(
        string $default_callback_url,
        string $allowlist
    ): bool {
        if ($default_callback_url === '') {
            return false;
        }

        $normalized = untrailingslashit($default_callback_url);
        $lines = preg_split('/\R+/', $allowlist);

        if (!is_array($lines)) {
            return false;
        }

        foreach ($lines as $line) {
            if (
                untrailingslashit(trim((string) $line)) ===
                $normalized
            ) {
                return true;
            }
        }

        return false;
    }
}