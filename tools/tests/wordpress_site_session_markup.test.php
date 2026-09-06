<?php
/** Exercise the real renderer using deterministic public WordPress fixtures. */
define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);

$signed_in = false;
$admin = false;
function is_admin(): bool { return $GLOBALS['admin']; }
function is_user_logged_in(): bool { return $GLOBALS['signed_in']; }
function apply_filters($name, $value) { return $value; }
function determine_locale(): string { return 'en_US'; }
function home_url($path = ''): string { return 'https://calorietoken.net' . $path; }
function get_queried_object_id(): int { return 42; }
function is_singular(): bool { return true; }
function is_front_page(): bool { return false; }
function get_permalink($id): string { return home_url('/index.php/about/'); }
function wp_parse_url($url) { return parse_url($url); }
function untrailingslashit($value): string { return rtrim($value, '/'); }
function esc_url_raw($value, $protocols = null): string { return $value; }
function esc_attr($value): string { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
function esc_url($value): string { return esc_attr($value); }
function esc_attr__($value, $domain): string { return esc_attr($value); }
function esc_html__($value, $domain): string { return esc_attr($value); }
function add_query_arg($query, $url): string { return $url . '?' . http_build_query($query); }
function wp_logout_url($redirect): string {
    return add_query_arg(['action' => 'logout', '_wpnonce' => 'synthetic-nonce', 'redirect_to' => $redirect], home_url('/wp-login.php'));
}

$plugin = dirname(__DIR__, 2) . '/wordpress-plugins/calorieapp-identity-bridge/includes/';
require $plugin . 'class-calorieapp-identity-bridge-locale-registry.php';
require $plugin . 'class-calorieapp-identity-bridge-integrated-login.php';
$class = new ReflectionClass(CalorieApp\IdentityBridge\IntegratedLogin::class);
$bridge = $class->newInstanceWithoutConstructor();
function render($bridge): string {
    ob_start();
    $bridge->render_site_integration();
    return (string) ob_get_clean();
}
function check($condition, $message): void {
    if (!$condition) { throw new RuntimeException($message); }
}

$html = render($bridge);
check(str_contains($html, 'data-calorieapp-site-integration'), 'Anonymous pages need the common sign-in navigation.');
check(str_contains($html, 'data-locale="en"'), 'The renderer resolves the canonical locale.');
check(str_contains($html, 'https://calorieapp-backend-rvul.onrender.com/health?resume_login=true'), 'Use the existing accepted startup route.');
check(!str_contains($html, 'data-calorieapp-sitewide-session-actions'), 'Anonymous pages must not claim a signed-in session.');
check(!str_contains($html, '<iframe'), 'An idle website page must not load an app frame.');

$signed_in = true;
$html = render($bridge);
check(substr_count($html, 'data-calorieapp-sitewide-session-actions') === 1, 'Authenticated non-app pages need one joint-logout control.');
check(str_contains($html, 'synthetic-nonce'), 'Use the nonce-protected WordPress logout URL.');
check(str_contains($html, rawurlencode(home_url('/index.php/about/'))), 'Logout returns to the current website page.');
check(!str_contains($html, '<iframe'), 'The sign-out frame must be created only after a click.');

$property = $class->getProperty('shortcode_rendered');
$property->setValue($bridge, true);
check(!str_contains(render($bridge), 'data-calorieapp-sitewide-session-actions'), 'The app page retains its existing joint-logout control without a duplicate.');
$admin = true;
check(render($bridge) === '', 'Do not add public session controls in wp-admin.');
echo "WordPress site-session renderer checks passed.\n";
