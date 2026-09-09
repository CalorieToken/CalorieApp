<?php
// Executable PHP coverage; run once normally and once with the preview argument.
define('ABSPATH', __DIR__);
define('CALORIEAPP_IDENTITY_BRIDGE_FILE', __DIR__ . '/plugin.php');
define('CALORIEAPP_IDENTITY_BRIDGE_VERSION', 'test');
if (($argv[1] ?? '') === 'preview') define('CALORIEAPP_DISPLAY_LANGUAGE_PREVIEW', true);
$lane = 'public';
$page_id = 1121;
$preview = false;
$post_status = 'publish';
$post_password = '';
$site_locale = 'nl_NL';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = [];
$scripts = [];
$inline = [];
function is_admin() { global $lane; return $lane === 'admin'; }
function is_feed() { global $lane; return $lane === 'feed'; }
function is_embed() { global $lane; return $lane === 'embed'; }
function wp_doing_ajax() { global $lane; return $lane === 'ajax'; }
function is_page($id) { global $page_id; return $page_id === $id; }
function is_preview() { global $preview; return $preview; }
function get_post_status($id) { global $post_status; check($id === 6855, 'Only the known FAQ is inspected'); return $post_status; }
function get_post_field($field, $id, $context) {
    global $post_password;
    check($field === 'post_password' && $id === 6855 && $context === 'raw', 'Inspect only public-page password protection');
    return $post_password;
}
function plugin_dir_url($file) { return 'https://calorietoken.net/plugin/'; }
function get_locale() { return $GLOBALS['site_locale']; }
function __($value, $domain) { return $value; }
function wp_enqueue_style(...$args) { global $scripts; $scripts[] = $args; }
function wp_enqueue_script(...$args) { global $scripts; $scripts[] = $args; }
function wp_add_inline_script(...$args) { global $inline; $inline[] = $args; }
function wp_json_encode($data, $flags = 0) { return json_encode($data, $flags); }
function esc_attr($value) { return htmlspecialchars((string) $value, ENT_QUOTES); }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES); }
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$includes = dirname(__DIR__, 2) . '/wordpress-plugins/calorieapp-identity-bridge/includes/';
require $includes . 'class-calorieapp-identity-bridge-locale-registry.php';
require $includes . 'class-calorieapp-identity-bridge-display-language.php';
$view = new \CalorieApp\IdentityBridge\DisplayLanguage();
$view->enqueue();
ob_start(); $view->render(); $view->render(); $html = ob_get_clean();
if (!defined('CALORIEAPP_DISPLAY_LANGUAGE_PREVIEW')) {
    check($html === '' && $scripts === [] && $inline === [], 'Default behavior must add no assets, control or storage config');
    $page_id = 6855;
    $other = new \CalorieApp\IdentityBridge\DisplayLanguage();
    $other->enqueue(); ob_start(); $other->render(); $html = ob_get_clean();
    check($html === '' && $scripts === [] && $inline === [], 'FAQ also stays completely off by default');
} else {
    check(substr_count($html, '<select ') === 1 && substr_count($html, '<option ') === 11, 'Exactly one selector and eleven options');
    check(strpos($html, 'data-calorieapp-display-language hidden') !== false, 'Preview starts hidden until initialized');
    check(count($scripts) === 3 && count($inline) === 1, 'One isolated display controller and stylesheet');
    check(strpos($inline[0][1], '"initialLocale":"nl"') !== false, 'Use public page locale');
    check(strpos($inline[0][1], '"cmsPreview"') === false, 'Other pages have no FAQ catalogue');
    $copy = json_decode(file_get_contents(dirname($includes) . '/config/display-language.json'), true);
    foreach (\CalorieApp\IdentityBridge\LocaleRegistry::tags() as $site_locale) {
        ob_start(); (new \CalorieApp\IdentityBridge\DisplayLanguage())->render(); $localized = ob_get_clean();
        check(str_contains($localized, 'data-calorieapp-language-label>' . esc_html($copy[$site_locale]['label']) . '</label>'), 'Server-render the prepared selector label for ' . $site_locale);
    }
    $site_locale = 'de_DE';
    ob_start(); (new \CalorieApp\IdentityBridge\DisplayLanguage())->render(); $fallback = ob_get_clean();
    check(str_contains($fallback, 'data-calorieapp-language-label>Language</label>'), 'Unsupported public locales use the explicit English fallback');
    $site_locale = 'nl_NL';

    $cases = [
        ['public FAQ', [], 'GET', 6855, false, 'publish', '', true],
        ['public language hint', ['ui_lang' => 'ar'], 'GET', 6855, false, 'publish', '', true],
        ['other page', [], 'GET', 1121, false, 'publish', '', false],
        ['public Richlist', [], 'GET', 3243, false, 'publish', '', false],
        ['public Trustline', [], 'GET', 1205, false, 'publish', '', false],
        ['POST', [], 'POST', 6855, false, 'publish', '', false],
        ['HEAD', [], 'HEAD', 6855, false, 'publish', '', false],
        ['unknown method', [], '', 6855, false, 'publish', '', false],
        ['WP preview', [], 'GET', 6855, true, 'publish', '', false],
        ['draft', [], 'GET', 6855, false, 'draft', '', false],
        ['private', [], 'GET', 6855, false, 'private', '', false],
        ['protected page', [], 'GET', 6855, false, 'publish', 'synthetic-password', false],
        ['editor query', ['brizy-edit' => ''], 'GET', 6855, false, 'publish', '', false],
        ['preview query', ['preview' => 'true'], 'GET', 6855, false, 'publish', '', false],
        ['identity query', ['locale' => 'nl'], 'GET', 6855, false, 'publish', '', false],
        ['unknown query', ['utm_source' => 'test'], 'GET', 6855, false, 'publish', '', false],
        ['array hint', ['ui_lang' => ['nl']], 'GET', 6855, false, 'publish', '', false],
    ];
    foreach ($cases as [$name, $query, $method, $page_id, $preview, $post_status, $post_password, $expected]) {
        $_GET = $query; $_SERVER['REQUEST_METHOD'] = $method;
        $scripts = []; $inline = [];
        (new \CalorieApp\IdentityBridge\DisplayLanguage())->enqueue();
        check(count($inline) === 1 && count($scripts) === ($expected ? 4 : 3), $name . ': retain the existing control, restrict added asset');
        $prefix = 'window.calorieappDisplayLanguageConfig = ';
        $configuration = json_decode(substr($inline[0][1], strlen($prefix), -1), true);
        check(is_array($configuration), $name . ': readable public configuration');
        check(count($configuration['navigation']['translations']) === 11, 'Eleven public navigation locales');
        check($configuration['navigation']['release_approved'] === false, 'Navigation copy remains unapproved');
        check(isset($configuration['richlist']) === ($page_id === 3243), 'Richlist copy is restricted to its page');
        if ($page_id === 3243) {
            check(count($configuration['richlist']['translations']) === 11, 'Eleven public Richlist locales');
            check($configuration['richlist']['release_approved'] === false, 'Richlist copy remains unapproved');
        }
        check(isset($configuration['trustline']) === ($page_id === 1205), 'Trustline copy is restricted to its page');
        if ($page_id === 1205) {
            check(count($configuration['trustline']['translations']) === 11, 'Eleven public Trustline helper locales');
            check($configuration['trustline']['release_approved'] === false, 'Trustline translations remain unapproved');
        }
        check(isset($configuration['cmsPreview']) === $expected, $name . ': restrict sample data');
        $controller = $scripts[count($scripts) - 1];
        $dependencies = ['calorieapp-display-language-runtime'];
        if ($expected) {
            $dependencies[] = 'calorieapp-cms-language-preview';
            check($scripts[2][0] === 'calorieapp-cms-language-preview' && $scripts[2][4] === true, 'FAQ adapter loads in the footer');
            check($configuration['cmsPreview']['wordpress_id'] === 6855, 'Catalogue matches the allowed page');
            check($configuration['cmsPreview']['release_approved'] === false, 'Wiring never advances copy approval');
        }
        check($controller[0] === 'calorieapp-display-language' && $controller[2] === $dependencies, 'Dependencies precede the shared controller');
    }
    $page_id = 6855; $preview = false; $post_status = 'publish'; $post_password = '';
    $_GET = []; $_SERVER['REQUEST_METHOD'] = 'GET';
    foreach (['admin', 'feed', 'embed', 'ajax'] as $lane) {
        $scripts = []; $inline = [];
        $other = new \CalorieApp\IdentityBridge\DisplayLanguage();
        $other->enqueue(); ob_start(); $other->render(); $html = ob_get_clean();
        check($html === '' && $scripts === [] && $inline === [], 'Non-page responses remain unchanged');
    }
    $lane = 'public'; define('REST_REQUEST', true);
    $other = new \CalorieApp\IdentityBridge\DisplayLanguage();
    $other->enqueue(); ob_start(); $other->render(); $html = ob_get_clean();
    check($html === '' && $scripts === [] && $inline === [], 'REST response remains unchanged');
}
echo "Display language PHP checks passed\n";
