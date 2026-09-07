<?php
/** Execute the production page renderer and market route with offline WordPress fixtures. */
define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);
define('CALORIEAPP_IDENTITY_BRIDGE_FILE', __FILE__);
define('CALORIEAPP_IDENTITY_BRIDGE_VERSION', 'test');
$page = 'calorieapp';
$admin = false;
$feed = false;
$embed = false;
$actions = $styles = $scripts = $config = $cache = $requests = $routes = [];
function add_action($name, $callback, $priority = 10): void { $GLOBALS['actions'][$name][$priority][] = $callback; }
function is_admin(): bool { return $GLOBALS['admin']; }
function is_feed(): bool { return $GLOBALS['feed']; }
function is_embed(): bool { return $GLOBALS['embed']; }
function is_page($slug): bool { return $GLOBALS['page'] === $slug; }
function plugin_dir_url($file): string { return home_url('/wp-content/plugins/calorieapp-identity-bridge/'); }
function home_url($path): string { return 'https://calorietoken.net' . $path; }
function content_url($path): string { return home_url('/wp-content' . $path); }
function rest_url($path): string { return home_url('/wp-json/' . $path); }
function wp_date($format): string { return '2031'; }
function wp_enqueue_style($handle, ...$args): void { $GLOBALS['styles'][$handle] = $args; }
function wp_enqueue_script($handle, ...$args): void { $GLOBALS['scripts'][$handle] = $args; }
function wp_script_is($handle, $state): bool { return isset($GLOBALS['scripts'][$handle]); }
function wp_localize_script($handle, $name, $data): void { $GLOBALS['config'][$handle] = $data; }
function esc_attr($value): string { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_html($value): string { return esc_attr($value); }
function esc_url($value): string { return esc_attr($value); }
function esc_url_raw($value): string { return $value; }
function esc_attr__($value, $domain): string { return esc_attr($value); }
function esc_html__($value, $domain): string { return esc_attr($value); }
function __($value, $domain): string { return $value; }
function sanitize_text_field($value): string { return strip_tags($value); }
function get_transient($key) { return $GLOBALS['cache'][$key]['value'] ?? false; }
function set_transient($key, $value, $ttl): void { $GLOBALS['cache'][$key] = compact('value', 'ttl'); }
function wp_safe_remote_get($url, $options) { $GLOBALS['requests'][] = compact('url', 'options'); return $GLOBALS['upstream']; }
function wp_remote_retrieve_response_code($response): int { return $response['status']; }
function wp_remote_retrieve_body($response): string { return $response['body']; }
function is_wp_error($value): bool { return $value instanceof WP_Error; }
function register_rest_route($namespace, $route, $options): void { $GLOBALS['routes'][] = compact('namespace', 'route', 'options'); }
class WP_Error { public function __construct(public $code, public $message, public $data) {} }
class WP_REST_Response {
    public array $headers = [];
    public function __construct(public $data, public $status) {}
    public function header($name, $value): void { $this->headers[$name] = $value; }
}
function check($condition, $message): void { if (!$condition) throw new RuntimeException($message); }
function render($object): string { ob_start(); $object->render(); return (string) ob_get_clean(); }
$dir = dirname(__DIR__, 2) . '/wordpress-plugins/calorieapp-identity-bridge/includes/';
require $dir . 'class-calorieapp-identity-bridge-market-widget.php';
require $dir . 'class-calorieapp-identity-bridge-page-ending.php';
use CalorieApp\IdentityBridge\PageEnding;
use CalorieApp\IdentityBridge\MarketWidget;

$ending = new PageEnding();
$ending->register_hooks();
check(isset($actions['wp_footer'][5]), 'Render the ending before footer scripts.');
$ending->enqueue_assets();
check(count($styles) === 1 && count($scripts) === 1, 'Only the independent page-ending assets are queued.');
check($scripts['calorieapp-identity-bridge-page-ending'][1] === [], 'Do not load the authentication controller as a dependency.');
$html = render($ending);
check(substr_count($html, '<footer ') === 1, 'The app page receives one website footer.');
check(substr_count($html, 'data-calorieapp-xpmarket-widget') === 1, 'The app page receives one market card.');
check(strpos($html, 'calorieapp-page-market') < strpos($html, '<footer '), 'Place the market card before the footer.');
check(str_contains($html, 'Calorie aims to be the world’s food token'), 'Keep the website mission copy.');
check(str_contains($html, 'Operator: ICTHendrikse · KVK 73774693'), 'Keep the current operator copy.');
check(str_contains($html, '© 2031 ICTHendrikse'), 'Use the current WordPress year.');
foreach (['privacy-policy', 'terms-conditions'] as $slug) {
    check(str_contains($html, home_url('/index.php/' . $slug . '/')), 'Legal links must be usable without JavaScript.');
}
foreach (['Telegram', 'GitHub', 'X', 'Facebook', 'YouTube', 'LinkedIn', 'Instagram'] as $label) {
    check(str_contains($html, 'aria-label="' . $label . '"'), 'Keep named social links.');
}
check(str_contains($html, MarketWidget::TOKEN_PAGE), 'The server-rendered card must contain its fallback destination.');
check(!str_contains($html, '<iframe') && !str_contains($html, 'logout'), 'The ending must not add another app frame or session control.');
check(render($ending) === '', 'Repeated footer hooks must not duplicate the ending.');
foreach (['home', 'faq', 'privacy-policy'] as $page) {
    $styles = $scripts = [];
    $other = new PageEnding();
    $other->enqueue_assets();
    check(render($other) === '' && !$styles && !$scripts, 'Existing footers on other pages remain untouched.');
}
$page = 'calorieapp';
foreach (['admin', 'feed', 'embed'] as $flag) {
    $GLOBALS[$flag] = true;
    check(render(new PageEnding()) === '', 'Do not insert public page furniture into ' . $flag . ' responses.');
    $GLOBALS[$flag] = false;
}

$market = new MarketWidget();
$market->register_route();
check($routes[0]['options']['methods'] === 'GET' && $routes[0]['options']['permission_callback'] === '__return_true', 'Only read-only public market data is exposed.');
$ending->enqueue_assets();
$market->add_browser_config();
check(isset($config['calorieapp-identity-bridge-page-ending']['xpMarketWidgetUrl']), 'The separate market renderer receives its route.');
$payload = ['success' => true, 'data' => [
    'code' => 'Calorie', 'issuer' => 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY',
    'title' => 'Calorie Token', 'logo' => 'https://xpcdn.xpmarket.com/storage/logo/calorie.webp',
    'price' => 0.00000005, 'priceUsd' => 0.00000007, 'marketcap' => 4000,
    'holders' => 14000, 'rank' => 300, 'private_extra' => 'discard-me',
]];
$safe = MarketWidget::sanitize_payload($payload);
check($safe['code'] === 'Calorie' && !isset($safe['private_extra']), 'Only allowlisted CAL fields leave the endpoint.');
foreach ([['issuer', 'different-token'], ['logo', 'https://xpcdn.xpmarket.com.evil.test/x'], ['price', -1], ['rank', '1e309']] as [$key, $value]) {
    $bad = $payload;
    $bad['data'][$key] = $value;
    check(MarketWidget::sanitize_payload($bad) === null, 'Reject invalid field: ' . $key);
}
$bad = $payload;
unset($bad['data']['priceUsd']);
check(MarketWidget::sanitize_payload($bad) === null, 'Reject incomplete market data.');
$upstream = ['status' => 200, 'body' => json_encode($payload)];
$response = $market->get_widget();
check($response instanceof WP_REST_Response && $response->status === 200, 'Successful public data is returned.');
check(count($requests) === 1 && $requests[0]['options']['redirection'] === 0, 'Only the fixed XPMarket endpoint is fetched.');
check($requests[0]['options']['limit_response_size'] === 16384, 'Bound the upstream response size.');
check($response->headers['Cache-Control'] === 'public, max-age=300', 'Successful data uses a five-minute public cache.');
$market->get_widget();
check(count($requests) === 1, 'Cached requests must not refetch XPMarket.');
foreach ([new WP_Error('offline', 'offline', []), ['status' => 503, 'body' => ''], ['status' => 200, 'body' => '{}']] as $upstream) {
    $cache = $requests = [];
    check($market->get_widget() instanceof WP_Error, 'Failed upstream data must not become fake figures.');
    check($market->get_widget() instanceof WP_Error && count($requests) === 1, 'Back off for a minute after an upstream failure.');
}
echo "WordPress page-ending rendering, scope, market validation and cache checks passed.\n";
