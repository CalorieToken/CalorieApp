<?php
/**
 * Plugin Name: CalorieApp Account Profile
 * Description: Shows the saved CalorieApp nickname and a compact sign-in card without scrolling the page.
 * Version: 0.1.2
 * Requires PHP: 7.4
 */
namespace CalorieApp\AccountProfile;
if (!defined('ABSPATH')) { exit; }

function enqueue() {
    wp_enqueue_script('calorieapp-account-profile', plugins_url('assets/profile-widget.js', __FILE__), [], '0.1.2', true);
    wp_enqueue_style('calorieapp-account-profile', plugins_url('assets/profile-widget.css', __FILE__), [], '0.1.2');
    wp_enqueue_script('calorieapp-login-panel', plugins_url('assets/login-panel.js', __FILE__), ['calorieapp-account-profile'], '0.1.2', true);
    wp_enqueue_style('calorieapp-login-panel', plugins_url('assets/login-panel.css', __FILE__), [], '0.1.2');
    // Public configuration only: safe even when the surrounding page is cached.
    wp_add_inline_script('calorieapp-account-profile', 'window.CalorieAppAccountProfile=' . wp_json_encode([
        'endpoint' => admin_url('admin-ajax.php'),
        'accountUrl' => home_url('/index.php/calorieapp/'),
        'loginCopy' => json_decode(file_get_contents(__DIR__ . '/assets/login-panel-copy.json'), true),
    ]) . ';', 'before');
}
add_action('wp_enqueue_scripts', __NAMESPACE__ . '\\enqueue', 30);

function read_profile() {
    nocache_headers();
    if (($_SERVER['HTTP_X_CALORIEAPP_REQUEST'] ?? '') !== 'account-profile-widget') {
        wp_send_json(['nickname' => null], 403);
    }
    if (!is_user_logged_in()) { wp_send_json(['nickname' => null]); }
    if (!class_exists('CalorieApp\\IdentityBridge\\Plugin')) {
        wp_send_json(['nickname' => null], 503);
    }
    $options = \CalorieApp\IdentityBridge\Plugin::get_options();
    $backend = rtrim((string) ($options['calorieapp_backend_url'] ?? ''), '/');
    $secret = (string) ($options['bridge_secret'] ?? '');
    $client = (string) ($options['backend_client_id'] ?? '');
    if (wp_parse_url($backend, PHP_URL_SCHEME) !== 'https' || $secret === '' || $client === '') {
        wp_send_json(['nickname' => null], 503);
    }
    // The caller cannot supply an account ID. Use the authenticated WP user.
    $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    $subject = 'wp:' . $host . ':' . get_current_user_id();
    $timestamp = (string) time();
    $nonce = bin2hex(random_bytes(24));
    $canonical = wp_json_encode([
        'version' => 'v1', 'client_id' => $client, 'timestamp' => $timestamp,
        'nonce' => $nonce, 'state' => 'account-profile-v1:' . $subject,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $response = wp_safe_remote_post($backend . '/api/identity/profile/wordpress', [
        'timeout' => 8, 'redirection' => 0,
        'headers' => [
            'Content-Type' => 'application/json',
            'X-CalorieApp-Client-Id' => $client,
            'X-CalorieApp-Timestamp' => $timestamp,
            'X-CalorieApp-Nonce' => $nonce,
            'X-CalorieApp-Signature' => hash_hmac('sha256', $canonical, $secret),
        ],
        'body' => wp_json_encode(['external_subject' => $subject]),
    ]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        wp_send_json(['nickname' => null], 503);
    }
    $data = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($data) || !array_key_exists('nickname', $data) ||
        ($data['nickname'] !== null && (!is_string($data['nickname']) || strlen($data['nickname']) > 128))) {
        wp_send_json(['nickname' => null], 502);
    }
    wp_send_json(['nickname' => $data['nickname']]);
}
add_action('wp_ajax_calorieapp_profile', __NAMESPACE__ . '\\read_profile');
add_action('wp_ajax_nopriv_calorieapp_profile', __NAMESPACE__ . '\\read_profile');
