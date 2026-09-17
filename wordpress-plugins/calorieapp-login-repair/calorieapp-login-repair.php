<?php
/**
 * Plugin Name: CalorieApp Login Repair
 * Description: Applies a verified, reversible login transport correction to Identity Bridge 0.3.29.
 * Version: 1.0.0
 * Author: CalorieApp
 * License: GPL-2.0-or-later
 * Requires PHP: 7.4
 */

namespace CalorieApp\LoginRepair;

if (!defined('ABSPATH')) {
    exit;
}

final class Repair {
    public const BEFORE_SHA256 = 'c734dfdffde0071ad8d59eb2f8ee9afb8b3001fa88ee28da955f3db28bae1d60';
    public const AFTER_SHA256 = '282b0db0a68f6de9392b48449ee3e51fff5deaeb88f705a28649d3901aaf065b';
    private const OPTION = 'calorieapp_login_repair_status';

    public static function activate(): void {
        if (!current_user_can('activate_plugins')) {
            wp_die('Je hebt geen toestemming om plugins te activeren.');
        }
        if (
            !defined('CALORIEAPP_IDENTITY_BRIDGE_VERSION')
            || CALORIEAPP_IDENTITY_BRIDGE_VERSION !== '0.3.29'
            || !class_exists('CalorieApp\\IdentityBridge\\RestApi')
        ) {
            wp_die('Activeer eerst de bestaande CalorieApp Identity Bridge 0.3.29. Er is niets gewijzigd.');
        }
        $error = self::replace(self::BEFORE_SHA256, self::AFTER_SHA256, 'after.php');
        if ($error !== '') {
            wp_die(esc_html($error));
        }
        update_option(self::OPTION, 'applied', false);
    }

    public static function deactivate(): void {
        if (!current_user_can('activate_plugins')) {
            return;
        }
        $error = self::replace(self::AFTER_SHA256, self::BEFORE_SHA256, 'before.php');
        update_option(self::OPTION, $error === '' ? 'restored' : 'restore_skipped', false);
    }

    private static function target(): string {
        return WP_PLUGIN_DIR . '/calorieapp-identity-bridge/includes/class-calorieapp-identity-bridge-rest.php';
    }

    private static function replace(string $expected, string $replacement, string $payload): string {
        $target = self::target();
        // Never follow a symlink or touch a different plugin installation.
        $plugin_root = realpath(WP_PLUGIN_DIR);
        if (
            $plugin_root === false
            || is_link($target)
            || realpath($target) !== $plugin_root . '/calorieapp-identity-bridge/includes/class-calorieapp-identity-bridge-rest.php'
        ) {
            return 'De bestaande Bridge-installatie kon niet veilig worden vastgesteld. Er is niets gewijzigd.';
        }
        $current = hash_file('sha256', $target);
        if (is_string($current) && hash_equals($replacement, $current)) {
            return ''; // Repeated activation/deactivation is harmless.
        }
        if (!is_string($current) || !hash_equals($expected, $current)) {
            return 'De bestaande login-code wijkt af van de gecontroleerde versie. Er is niets gewijzigd. Download de huidige Identity Bridge-plugin voor controle.';
        }
        $source = __DIR__ . '/payload/' . $payload;
        $contents = is_file($source) ? file_get_contents($source) : false;
        if (!is_string($contents) || !hash_equals($replacement, hash('sha256', $contents))) {
            return 'Het herstelpakket is onvolledig of gewijzigd. Er is niets gewijzigd.';
        }
        if (!is_writable($target) || !is_writable(dirname($target))) {
            return 'WordPress kan het login-bestand niet bijwerken. Er is niets gewijzigd.';
        }
        $temporary = tempnam(dirname($target), '.calorieapp-repair-');
        if ($temporary === false || dirname($temporary) !== dirname($target)) {
            if (is_string($temporary)) {
                unlink($temporary);
            }
            return 'Het herstelbestand kon niet worden voorbereid. Er is niets gewijzigd.';
        }
        $written = file_put_contents($temporary, $contents, LOCK_EX);
        $permissions = fileperms($target);
        if (
            $written !== strlen($contents)
            || !hash_equals($replacement, (string) hash_file('sha256', $temporary))
            || $permissions === false
            || !chmod($temporary, $permissions & 0777)
        ) {
            unlink($temporary);
            return 'Het herstelbestand kon niet worden gecontroleerd. Er is niets gewijzigd.';
        }
        // Check again immediately before the atomic replacement; do not
        // overwrite a plugin update that finished while preparing the file.
        clearstatcache(true, $target);
        if (!hash_equals($expected, (string) hash_file('sha256', $target))) {
            unlink($temporary);
            return 'De Bridge is ondertussen bijgewerkt. Er is niets gewijzigd.';
        }
        if (!rename($temporary, $target)) {
            unlink($temporary);
            return 'Het login-bestand kon niet worden vervangen. Er is niets gewijzigd.';
        }
        if (function_exists('wp_opcache_invalidate')) {
            wp_opcache_invalidate($target, true);
        } elseif (function_exists('opcache_invalidate')) {
            opcache_invalidate($target, true);
        }
        return '';
    }

    public static function notice(): void {
        if (!current_user_can('activate_plugins')) {
            return;
        }
        $target = self::target();
        $applied = is_file($target) && hash_equals(self::AFTER_SHA256, (string) hash_file('sha256', $target));
        $message = $applied
            ? 'CalorieApp Login Repair: de gecontroleerde login-correctie is toegepast. Controleer nu aanmelden en gezamenlijk afmelden.'
            : 'CalorieApp Login Repair: de login-correctie is momenteel niet toegepast. De Bridge kan inmiddels zijn bijgewerkt.';
        echo '<div class="notice notice-' . ($applied ? 'success' : 'warning') . '"><p>' . esc_html($message) . '</p></div>';
    }
}

register_activation_hook(__FILE__, [Repair::class, 'activate']);
register_deactivation_hook(__FILE__, [Repair::class, 'deactivate']);
add_action('admin_notices', [Repair::class, 'notice']);
