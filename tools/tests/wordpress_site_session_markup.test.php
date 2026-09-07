<?php
/** Exercise the real renderer using deterministic public WordPress fixtures. */
define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);
define('CALORIEAPP_IDENTITY_BRIDGE_FILE', __FILE__);

$signed_in = false;
$admin = false;
$registered_scripts = [];
$enqueued_scripts = [];
function plugin_dir_url($path): string { return 'https://calorietoken.net/wp-content/plugins/calorieapp-identity-bridge/'; }
function wp_register_style(...$args): void {}
function wp_enqueue_style(...$args): void {}
function wp_register_script($handle, $src, $deps, ...$args): void {
    $GLOBALS['registered_scripts'][$handle] = ['src' => $src, 'deps' => $deps];
}
function wp_enqueue_script($handle): void { $GLOBALS['enqueued_scripts'][] = $handle; }
function is_admin(): bool { return $GLOBALS['admin']; }
function is_user_logged_in(): bool { return $GLOBALS['signed_in']; }
function apply_filters($name, $value) { return $value; }
function determine_locale(): string { return 'en_US'; }
function home_url($path = ''): string { return 'https://calorietoken.net' . $path; }
function get_queried_object_id(): int { return 42; }
function is_singular(): bool { return true; }
function is_front_page(): bool { return false; }
function get_permalink($id = 0): string { return home_url('/index.php/about/'); }
function shortcode_atts($defaults, $attributes, $name): array { return array_merge($defaults, array_intersect_key($attributes, $defaults)); }
function wp_generate_uuid4(): string { return '00000000-0000-4000-8000-000000000001'; }
function wp_script_is($handle, $state): bool { return isset($GLOBALS['registered_scripts'][$handle]); }
function rest_url($path): string { return home_url('/index.php/wp-json/' . $path); }
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

$bridge->register_assets();
check($enqueued_scripts === [], 'Asset registration must not enqueue the full login bridge on ordinary pages.');
check($registered_scripts['calorieapp-identity-bridge-site-session']['deps'] === [], 'The site controller must not pull in the full embed script.');
$html = render($bridge);
check($enqueued_scripts === ['calorieapp-identity-bridge-site-session'], 'The footer queues only the smaller site controller on ordinary pages.');
check(str_contains($html, 'data-calorieapp-site-integration'), 'Anonymous pages need the common sign-in navigation.');
check(str_contains($html, 'data-locale="en"'), 'The renderer resolves the canonical locale.');
check(str_contains($html, 'data-home-page="https://calorietoken.net/"'), 'Floating navigation uses the configured website home.');
check(str_contains($html, 'assets/calorieapp-logo.svg'), 'Floating navigation receives the bundled original vector logo.');
check(str_contains($html, 'https://calorieapp-backend-rvul.onrender.com/health?resume_login=true'), 'Use the existing accepted startup route.');
check(!str_contains($html, 'data-calorieapp-sitewide-session-actions'), 'Anonymous pages must not claim a signed-in session.');
check(!str_contains($html, '<iframe'), 'An idle website page must not load an app frame.');

$signed_in = true;
$html = render($bridge);
check(substr_count($html, 'data-calorieapp-sitewide-session-actions') === 1, 'Authenticated non-app pages need one joint-logout control.');
check(str_contains($html, 'synthetic-nonce'), 'Use the nonce-protected WordPress logout URL.');
check(str_contains($html, 'data-idle-label="Log out"'), 'Use the short, consistent visible logout label.');
check(str_contains($html, 'Log out of CalorieToken.net and CalorieApp on this device'), 'Explain which sessions are ended on this device.');
check(str_contains($html, rawurlencode(home_url('/index.php/about/'))), 'Logout returns to the current website page.');
check(!str_contains($html, '<iframe'), 'The sign-out frame must be created only after a click.');

$property = $class->getProperty('shortcode_rendered');
$property->setValue($bridge, true);
$enqueued_scripts = ['calorieapp-identity-bridge-embed'];
check(!str_contains(render($bridge), 'data-calorieapp-sitewide-session-actions'), 'The app page retains its existing joint-logout control without a duplicate.');
check($enqueued_scripts === ['calorieapp-identity-bridge-embed', 'calorieapp-identity-bridge-site-session'], 'The full bridge queued by the shortcode must precede the return controller.');
$admin = true;
check(render($bridge) === '', 'Do not add public session controls in wp-admin.');
$admin = false;
foreach ([false, true] as $signed_in) {
    $embed = $bridge->render_shortcode(['src' => 'https://app.calorietoken.net', 'locale' => 'nl', 'height' => '900']);
    check(substr_count($embed, '<iframe') === 1, 'The startup cover must not add another application frame.');
    check(substr_count($embed, 'data-calorieapp-embed-loading') === 1, 'Render one startup cover before the iframe loads.');
    check(strpos($embed, 'data-calorieapp-embed-loading') < strpos($embed, '<iframe'), 'The startup cover is present in server-rendered markup.');
    check(str_contains($embed, 'data-app-origin="https://app.calorietoken.net"') && str_contains($embed, 'data-locale="nl"'), 'Retain the existing origin and locale binding.');
    check(str_contains($embed, 'height: 900px') && str_contains($embed, 'loading="eager"'), 'Retain the existing iframe sizing and loading strategy.');
    check(str_contains($embed, '<noscript>') && str_contains($embed, 'visibility:visible!important'), 'Do not leave the cover blocking the frame when scripts are disabled.');
    check(strpos($embed, 'calorieapp-login-modal') > strpos($embed, '</iframe>'), 'Keep the sign-in modal outside the startup cover.');
    if ($signed_in) {
        check(strpos($embed, 'calorieapp-site-logout') < strpos($embed, 'data-calorieapp-frame-stage'), 'Keep the working logout control outside the covered frame.');
    }
}
echo "WordPress site-session renderer checks passed.\n";
