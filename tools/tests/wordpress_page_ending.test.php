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
$ajax = false;
$singular = true;
$locale = 'en_US';
$preview = false;
$post_status = 'publish';
$post_password = '';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = [];
$actions = $styles = $scripts = $config = $cache = $requests = $routes = [];
$options = $option_reads = [];
function add_action($name, $callback, $priority = 10): void { $GLOBALS['actions'][$name][$priority][] = $callback; }
function is_admin(): bool { return $GLOBALS['admin']; }
function is_feed(): bool { return $GLOBALS['feed']; }
function is_embed(): bool { return $GLOBALS['embed']; }
function wp_doing_ajax(): bool { return $GLOBALS['ajax']; }
function is_singular(): bool { return $GLOBALS['singular']; }
function is_page($slug): bool { return $GLOBALS['page'] === $slug; }
function is_preview(): bool { return $GLOBALS['preview']; }
function get_post_status($id) { return $GLOBALS['post_status']; }
function get_post_field($field, $id, $context) { return $GLOBALS['post_password']; }
function get_locale(): string { return $GLOBALS['locale']; }
function plugin_dir_url($file): string { return home_url('/wp-content/plugins/calorieapp-identity-bridge/'); }
function home_url($path): string { return 'https://calorietoken.net' . $path; }
function content_url($path): string { return home_url('/wp-content' . $path); }
function rest_url($path): string { return home_url('/wp-json/' . $path); }
function wp_date($format): string { return '2031'; }
function wp_enqueue_style($handle, ...$args): void { $GLOBALS['styles'][$handle] = $args; }
function wp_enqueue_script($handle, ...$args): void { $GLOBALS['scripts'][$handle] = $args; }
function wp_script_is($handle, $state): bool { return isset($GLOBALS['scripts'][$handle]); }
function wp_localize_script($handle, $name, $data): void {
    // Match WordPress's scalar-to-text behavior instead of hiding type bugs.
    foreach ($data as $key => $value) {
        if (is_scalar($value)) $data[$key] = html_entity_decode((string) $value, ENT_QUOTES, 'UTF-8');
    }
    $GLOBALS['config'][$handle] = $data;
}
function wp_json_encode($value, $flags = 0): string { return json_encode($value, $flags | JSON_THROW_ON_ERROR); }
function wp_add_inline_script($handle, $data, $position = 'after'): bool {
    check($position === 'before', 'The boolean configuration must precede the presentation script.');
    check(preg_match('/^window\.calorieappSitePolish = (.+);$/D', $data, $matches) === 1, 'Only the expected data assignment is allowed.');
    $GLOBALS['config'][$handle] = json_decode($matches[1], true, 512, JSON_THROW_ON_ERROR);
    return true;
}
function get_option($name) { $GLOBALS['option_reads'][] = $name; return $GLOBALS['options'][$name] ?? false; }
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
require $dir . 'class-calorieapp-identity-bridge-locale-registry.php';
require $dir . 'class-calorieapp-identity-bridge-page-ending.php';
use CalorieApp\IdentityBridge\PageEnding;
use CalorieApp\IdentityBridge\MarketWidget;

$ending = new PageEnding();
$ending->register_hooks();
check(isset($actions['wp_footer'][5]), 'Render the ending before footer scripts.');
$ending->enqueue_assets();
check(count($styles) === 2 && count($scripts) === 2, 'The independent page-ending and presentation assets are queued.');
check(!isset($config['calorieapp-identity-bridge-site-polish']['blog']), 'Other pages do not receive blog copy');
$page = 1207;
(new PageEnding())->enqueue_assets();
$blog = $config['calorieapp-identity-bridge-site-polish']['blog'];
check($blog['publicPage'] === true && count($blog['copy']) === 11 && $blog['initialLocale'] === 'en', 'Public blog has eleven-locale static helper copy');
check(count($styles) === 2 && count($scripts) === 2, 'Blog adds no provider script or stylesheet');
foreach ([['POST', false, 'publish', ''], ['GET', true, 'publish', ''], ['GET', false, 'private', ''], ['GET', false, 'draft', ''], ['GET', false, 'publish', 'synthetic']] as [$method, $preview, $post_status, $post_password]) {
    $_SERVER['REQUEST_METHOD'] = $method;
    (new PageEnding())->enqueue_assets();
    check(!isset($config['calorieapp-identity-bridge-site-polish']['blog']), 'Nonpublic/preview/POST contexts do not receive blog helper readiness');
}
$page = 'calorieapp'; $preview = false; $post_status = 'publish'; $post_password = ''; $_SERVER['REQUEST_METHOD'] = 'GET';
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
check(substr_count($html, 'data-calorieapp-app-info') === 1, 'The app also receives one informational component.');
check(!str_contains($html, 'class="calorieapp-app-info-link"'), 'Do not reload the already-open app with a duplicate CTA.');
check(render($ending) === '', 'Repeated footer hooks must not duplicate the ending.');
foreach (['home', 'faq', 'privacy-policy', 'delivery', 'cafes', 'takeaway', 'restaurants', 'groceries', 'wholesalers', 'contact', 'donate', 'cart', 'checkout', 'article', 'draft-preview'] as $page) {
    $styles = $scripts = [];
    $other = new PageEnding();
    $other->enqueue_assets();
    $other_html = render($other);
    check(substr_count($other_html, 'data-calorieapp-sitewide-market') === 1, 'Other singular pages receive one deduplicated market candidate.');
    check(substr_count($other_html, 'data-calorieapp-app-info') === 1, 'Every public page type receives one app information block.');
    check(str_contains($other_html, '<footer class="calorieapp-shared-footer" hidden>'), 'Keep the original footer until the guarded browser replacement succeeds.');
    check(preg_match('/<noscript>(.*?)<\/noscript>/s', $other_html, $fallback) === 1, 'Pages with a hidden footer candidate need a no-JavaScript legal fallback.');
    foreach (['privacy-policy', 'terms-conditions'] as $slug) {
        check(str_contains($fallback[1], home_url('/index.php/' . $slug . '/')), 'Legal destinations remain accessible when JavaScript is disabled.');
    }
    check(str_contains($other_html, 'class="calorieapp-app-info-link" href="' . home_url('/index.php/calorieapp/') . '"'), 'The widget uses the verified site app route.');
    check(count($styles) === 2 && count($scripts) === 2, 'Shared market and presentation assets load on other public pages too.');
}
$singular = false;
$archive_html = render(new PageEnding());
check(str_contains($archive_html, 'data-calorieapp-app-info') && str_contains($archive_html, '<footer '), 'Archive/search pages also receive the shared information and footer candidate.');
check(!str_contains($archive_html, 'data-calorieapp-xpmarket-widget'), 'Do not add market traffic to archive/search pages.');
$singular = true;
$copy_path = dirname($dir) . '/config/app-information.json';
$widget_copy = json_decode(file_get_contents($copy_path), true, 512, JSON_THROW_ON_ERROR);
foreach (CalorieApp\IdentityBridge\LocaleRegistry::tags() as $locale) {
    $localized = render(new PageEnding());
    check(str_contains($localized, 'lang="' . $locale . '"'), 'Use the public page locale for the informational component.');
    check(str_contains($localized, esc_html($widget_copy[$locale]['description'])), 'Render the available localized copy.');
    $direction = in_array($locale, ['ar', 'ur'], true) ? 'rtl' : 'ltr';
    check(str_contains($localized, 'dir="' . $direction . '"'), 'Preserve the locale direction.');
}
$locale = 'de_DE';
check(str_contains(render(new PageEnding()), 'lang="en"'), 'Unsupported page languages use the explicit English fallback.');
$locale = 'en_US';
check($requests === [], 'Rendering app information never calls a provider or the app.');
$shortcuts = new PageEnding();
ob_start();
$shortcuts->render_shortcuts();
$shortcut_html = (string) ob_get_clean();
check(substr_count($shortcut_html, 'data-calorieapp-fallback-shortcuts') === 1, 'Public pages need a fallback navigation surface.');
check(str_contains($shortcut_html, 'assets/calorieapp-logo.svg'), 'The fallback uses the original transparent vector mark.');
check(substr_count($shortcut_html, 'data-calorieapp-shortcut=') === 4, 'Provide Home, App, Top and Bottom slots for conditional display.');
ob_start();
$shortcuts->render_shortcuts();
check(ob_get_clean() === '', 'Repeated hooks cannot duplicate fallback navigation.');
$page = 'calorieapp';
check($config['calorieapp-identity-bridge-site-polish'] === ['trustlineReady' => false], 'No TrustSet CTA outside the trustline page.');
$page = 'trustline';
$ending->enqueue_assets();
check($config['calorieapp-identity-bridge-site-polish']['trustlineReady'] === false, 'Do not advertise an absent XUMM handler.');
if (!class_exists('Xummlogin_XUMM', false)) {
    class Xummlogin_XUMM {
        public function xummlogin_prepare_trustline(): void { throw new RuntimeException('Presentation must not create payloads.'); }
    }
}
$valid_options = [
    'xummlogin_trustline_issuer' => 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY',
    'xummlogin_trustline_currency' => '43616C6F72696500000000000000000000000000',
    'xummlogin_trustline_limit' => '1000000000',
];
$options = $valid_options;
$ending->enqueue_assets();
check($config['calorieapp-identity-bridge-site-polish'] === ['trustlineReady' => true, 'trustlinePage' => true], 'Exact CAL configuration enables boolean-only readiness and public-page markers.');
$options['xummlogin_trustline_currency'] = 'Calorie';
$ending->enqueue_assets();
check($config['calorieapp-identity-bridge-site-polish']['trustlineReady'] === true, 'The installed plugin also accepts the full textual currency code.');
foreach ([
    ['xummlogin_trustline_issuer', 'different-token'],
    ['xummlogin_trustline_currency', 'CAL'],
    ['xummlogin_trustline_limit', ''],
    ['xummlogin_trustline_limit', '0'],
    ['xummlogin_trustline_limit', '-1'],
    ['xummlogin_trustline_limit', '1e309'],
    ['xummlogin_trustline_limit', []],
] as [$key, $value]) {
    $options = $valid_options;
    $options[$key] = $value;
    $ending->enqueue_assets();
    check($config['calorieapp-identity-bridge-site-polish']['trustlineReady'] === false, 'Reject an unverified CAL configuration: ' . $key);
}
$options = $valid_options;
foreach ([
    ['public', [], 'GET', false, 'publish', '', true],
    ['language hint', ['ui_lang' => 'nl'], 'GET', false, 'publish', '', true],
    ['POST', [], 'POST', false, 'publish', '', false],
    ['HEAD', [], 'HEAD', false, 'publish', '', false],
    ['preview', [], 'GET', true, 'publish', '', false],
    ['draft', [], 'GET', false, 'draft', '', false],
    ['private', [], 'GET', false, 'private', '', false],
    ['password', [], 'GET', false, 'publish', 'synthetic-password', false],
    ['query', ['preview' => 'true'], 'GET', false, 'publish', '', false],
    ['array hint', ['ui_lang' => ['nl']], 'GET', false, 'publish', '', false],
] as [$name, $query, $method, $preview, $post_status, $post_password, $expected]) {
    $_GET = $query; $_SERVER['REQUEST_METHOD'] = $method;
    $ending->enqueue_assets();
    $presentation = $config['calorieapp-identity-bridge-site-polish'];
    check(($presentation['trustlinePage'] ?? false) === $expected, 'Restrict the public display marker: ' . $name);
    check($presentation['trustlineReady'] === true, 'Display checks do not change native handler readiness: ' . $name);
}
$_GET = []; $_SERVER['REQUEST_METHOD'] = 'GET';
$preview = false; $post_status = 'publish'; $post_password = '';
check(array_diff($option_reads, array_keys($valid_options)) === [], 'Presentation must not read credentials or unrelated options.');
$page = 'calorieapp';
foreach (['admin', 'feed', 'embed', 'ajax'] as $flag) {
    $GLOBALS[$flag] = true;
    $special = new PageEnding();
    check(render($special) === '', 'Do not insert public page furniture into ' . $flag . ' responses.');
    ob_start();
    $special->render_shortcuts();
    check(ob_get_clean() === '', 'No fallback navigation in ' . $flag . ' responses.');
    $styles = $scripts = [];
    $special->enqueue_assets();
    check(!$styles && !$scripts, 'No market assets in ' . $flag . ' responses.');
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
foreach (['holders', 'rank'] as $key) {
    foreach ([-1, 3.14, '3.14', '2147483648', '1e30', true, [], null] as $value) {
        $bad = $payload;
        $bad['data'][$key] = $value;
        check(MarketWidget::sanitize_payload($bad) === null, 'Reject fractional, overflowing or invalid count: ' . $key);
    }
    foreach ([0, '0', 300, '300', 2147483647, '2147483647'] as $value) {
        $valid = $payload;
        $valid['data'][$key] = $value;
        $normalized = MarketWidget::sanitize_payload($valid);
        check($normalized !== null && $normalized[$key] === (int) $value, 'Preserve zero and bounded integer counts: ' . $key);
    }
}
$cache['calorieapp_xpmarket_widget_v1'] = ['value' => ['holders' => -1], 'ttl' => 300];
$upstream = ['status' => 200, 'body' => json_encode($payload)];
$response = $market->get_widget();
check($response instanceof WP_REST_Response && $response->status === 200, 'Successful public data is returned.');
check(count($requests) === 1 && $requests[0]['options']['redirection'] === 0, 'Only the fixed XPMarket endpoint is fetched.');
check($requests[0]['url'] === 'https://api.xpmarket.com/api/currency/widget?token=Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY', 'The shared token identifier preserves the exact CAL data endpoint.');
check($requests[0]['options']['limit_response_size'] === 16384, 'Bound the upstream response size.');
check($response->headers['Cache-Control'] === 'public, max-age=0, must-revalidate', 'Browser and shared caches must revalidate instead of adding another freshness window.');
check($cache['calorieapp_xpmarket_widget_v2']['ttl'] === 300, 'Origin caching still limits upstream requests to once per five minutes and skips the older validation cache.');
$cached_response = $market->get_widget();
check($cached_response->headers === $response->headers, 'Transient hits retain the same revalidation policy.');
check(count($requests) === 1, 'Cached requests must not refetch XPMarket.');
foreach ([new WP_Error('offline', 'offline', []), ['status' => 503, 'body' => ''], ['status' => 200, 'body' => '{}']] as $upstream) {
    $cache = $requests = [];
    check($market->get_widget() instanceof WP_Error, 'Failed upstream data must not become fake figures.');
    check($market->get_widget() instanceof WP_Error && count($requests) === 1, 'Back off for a minute after an upstream failure.');
}
// Additive Tokenomics helper receives only public copy and no native signing readiness.
$page = 1209; $admin = $feed = $embed = $ajax = $preview = false;
$post_status = 'publish'; $post_password = ''; $_SERVER['REQUEST_METHOD'] = 'GET'; $_GET = [];
(new PageEnding())->enqueue_assets();
$tokenomics = $config['calorieapp-identity-bridge-site-polish']['tokenomics'];
check($tokenomics['publicPage'] === true && count($tokenomics['copy']) === 11, 'Tokenomics has eleven prepared public helper locales');
check($scripts['calorieapp-tokenomics'][1] === ['calorieapp-identity-bridge-site-polish'], 'Only the public presentation dependency is added');
foreach ([['POST', false, 'publish', '', []], ['GET', true, 'publish', '', []], ['GET', false, 'private', '', []], ['GET', false, 'publish', 'password', []], ['GET', false, 'publish', '', ['preview' => 'true']], ['GET', false, 'publish', '', ['ui_lang' => ['nl']]]] as [$method, $preview, $post_status, $post_password, $query]) {
    $_SERVER['REQUEST_METHOD'] = $method; $_GET = $query; unset($scripts['calorieapp-tokenomics']);
    (new PageEnding())->enqueue_assets();
    check(!isset($config['calorieapp-identity-bridge-site-polish']['tokenomics']) && !isset($scripts['calorieapp-tokenomics']), 'Nonpublic or unknown Tokenomics request receives no helper');
}


$page = 4205; $admin = $feed = $embed = $ajax = $preview = false;
$post_status = 'publish'; $post_password = ''; $_SERVER['REQUEST_METHOD'] = 'GET'; $_GET = [];
(new PageEnding())->enqueue_assets();
$guide = $config['calorieapp-identity-bridge-site-polish']['buyGuide'];
check($guide['publicPage'] === true && count($guide['copy']) === 11, 'How to Buy has eleven complete prepared locales');
check($scripts['calorieapp-buy-guide-language'][1] === ['calorieapp-identity-bridge-site-polish'], 'Only the public guide dependency is added');
foreach ([['POST', false, 'publish', '', []], ['GET', true, 'publish', '', []], ['GET', false, 'private', '', []], ['GET', false, 'publish', 'password', []], ['GET', false, 'publish', '', ['preview' => 'true']], ['GET', false, 'publish', '', ['ui_lang' => ['nl']]]] as [$method, $preview, $post_status, $post_password, $query]) {
    $_SERVER['REQUEST_METHOD'] = $method; $_GET = $query; unset($scripts['calorieapp-buy-guide-language']);
    (new PageEnding())->enqueue_assets();
    check(!isset($config['calorieapp-identity-bridge-site-polish']['buyGuide']) && !isset($scripts['calorieapp-buy-guide-language']), 'Unknown or nonpublic guide contexts remain native');
}

// PHP constants cannot be reset: exercise REST only after all public-page cases.
define('REST_REQUEST', true);
check(render(new PageEnding()) === '', 'REST responses must not receive public page furniture.');
$styles = $scripts = [];
(new PageEnding())->enqueue_assets();
check(!$styles && !$scripts, 'REST responses must not enqueue public presentation assets.');
echo "WordPress page-ending rendering, scope, market validation and cache checks passed.\n";
