<?php
/**
 * Plugin Name: CalorieApp Identity Bridge
 * Plugin URI: https://calorietoken.net
 * Description: Companion bridge plugin that maps authenticated WordPress/XUMM Login sessions to short-lived CalorieApp authorization codes.
 * Version: 0.3.21
 * Author: CalorieApp
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: calorieapp-identity-bridge
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('CALORIEAPP_IDENTITY_BRIDGE_FILE')) {
    define('CALORIEAPP_IDENTITY_BRIDGE_FILE', __FILE__);
}

if (!defined('CALORIEAPP_IDENTITY_BRIDGE_VERSION')) {
    define('CALORIEAPP_IDENTITY_BRIDGE_VERSION', '0.3.21');
}

require_once plugin_dir_path(__FILE__) . 'includes/class-calorieapp-identity-bridge.php';

\CalorieApp\IdentityBridge\Plugin::instance();

// Presentation is independent of the accepted login and joint-session controllers.
add_action('wp_enqueue_scripts', static function (): void {
    $assets = plugin_dir_url(__FILE__) . 'assets/';
    wp_enqueue_style('calorieapp-identity-bridge-layout', $assets . 'calorieapp-site-layout.css', [], CALORIEAPP_IDENTITY_BRIDGE_VERSION);
    wp_enqueue_script('calorieapp-identity-bridge-layout', $assets . 'calorieapp-site-layout.js', [], CALORIEAPP_IDENTITY_BRIDGE_VERSION, true);
}, 20);
