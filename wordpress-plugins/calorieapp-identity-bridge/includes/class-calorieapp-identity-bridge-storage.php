<?php

namespace CalorieApp\IdentityBridge;

use wpdb;

if (!defined('ABSPATH')) {
    exit;
}

class Storage {
    private string $table_name;

    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'calorieapp_auth_codes';
    }

    public function register_hooks(): void {
        add_action('init', [$this, 'maybe_upgrade']);
    }

    public function table_name(): string {
        return $this->table_name;
    }

    public function create_table(): void {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset_collate = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE {$this->table_name} (
            id varchar(36) NOT NULL,
            code_hash char(64) NOT NULL,
            wp_user_id bigint(20) unsigned NOT NULL,
            external_subject varchar(120) NOT NULL,
            state varchar(255) NOT NULL,
            xrpl_address varchar(64) NOT NULL,
            created_at datetime NOT NULL,
            expires_at datetime NOT NULL,
            used_at datetime NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY code_hash (code_hash),
            KEY state_idx (state),
            KEY expires_at_idx (expires_at),
            KEY wp_user_id_idx (wp_user_id)
        ) {$charset_collate};";

        dbDelta($sql);

        update_option('calorieapp_identity_bridge_schema_version', '1', false);
    }

    public function maybe_upgrade(): void {
        $schema_version = get_option('calorieapp_identity_bridge_schema_version', '0');
        if ($schema_version !== '1') {
            $this->create_table();
        }
    }

    public function issue_code(int $wp_user_id, string $state, string $xrpl_address, int $ttl_seconds = 60): array {
        global $wpdb;

        $plaintext_code = $this->generate_code();
        $code_hash = $this->hash_code($plaintext_code);
        $jti = wp_generate_uuid4();

        $created = current_time('mysql', true);
        $expires = gmdate('Y-m-d H:i:s', time() + $ttl_seconds);

        $external_subject = $this->build_external_subject($wp_user_id);

        $inserted = $wpdb->insert(
            $this->table_name,
            [
                'id' => $jti,
                'code_hash' => $code_hash,
                'wp_user_id' => $wp_user_id,
                'external_subject' => $external_subject,
                'state' => $state,
                'xrpl_address' => $xrpl_address,
                'created_at' => $created,
                'expires_at' => $expires,
                'used_at' => null,
            ],
            [
                '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s',
            ]
        );

        if (!$inserted) {
            return [
                'ok' => false,
                'error' => 'Failed to persist authorization code',
            ];
        }

        return [
            'ok' => true,
            'code' => $plaintext_code,
            'jti' => $jti,
            'external_subject' => $external_subject,
            'issued_at' => $created,
            'expires_at' => $expires,
        ];
    }

    public function consume_code(string $plaintext_code, string $state): array {
        global $wpdb;

        $code_hash = $this->hash_code($plaintext_code);

        $record = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->table_name} WHERE code_hash = %s LIMIT 1",
                $code_hash
            ),
            ARRAY_A
        );

        if (!$record) {
            return [
                'ok' => false,
                'error' => 'invalid_code',
            ];
        }

        if (!hash_equals((string) $record['state'], $state)) {
            return [
                'ok' => false,
                'error' => 'state_mismatch',
            ];
        }

        if (!empty($record['used_at'])) {
            return [
                'ok' => false,
                'error' => 'already_used',
            ];
        }

        $expires_ts = strtotime((string) $record['expires_at'] . ' UTC');
        if ($expires_ts === false || $expires_ts < time()) {
            return [
                'ok' => false,
                'error' => 'expired',
            ];
        }

        $updated = $wpdb->query(
            $wpdb->prepare(
                "UPDATE {$this->table_name}
                 SET used_at = %s
                 WHERE id = %s
                 AND used_at IS NULL",
                current_time('mysql', true),
                (string) $record['id']
            )
        );

        if ($updated !== 1) {
            return [
                'ok' => false,
                'error' => 'already_used',
            ];
        }

        return [
            'ok' => true,
            'claims' => [
                'external_subject' => (string) $record['external_subject'],
                'xrpl_address' => (string) $record['xrpl_address'],
                'issued_at' => gmdate(DATE_ATOM, strtotime((string) $record['created_at'] . ' UTC')),
                'expires_at' => gmdate(DATE_ATOM, $expires_ts),
                'jti' => (string) $record['id'],
            ],
        ];
    }

    public function cleanup_records(): void {
        global $wpdb;

        $cutoff_used = gmdate('Y-m-d H:i:s', time() - DAY_IN_SECONDS);
        $now = current_time('mysql', true);

        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$this->table_name}
                 WHERE expires_at < %s
                 OR (used_at IS NOT NULL AND used_at < %s)",
                $now,
                $cutoff_used
            )
        );
    }

    public function hash_code(string $plaintext_code): string {
        $salt = wp_salt('auth');
        return hash_hmac('sha256', $plaintext_code, $salt);
    }

    public function build_external_subject(int $wp_user_id): string {
        $host = wp_parse_url(home_url('/'), PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            $host = 'wordpress';
        }

        return 'wp:' . strtolower($host) . ':' . $wp_user_id;
    }

    private function generate_code(): string {
        $bytes = random_bytes(32);
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
