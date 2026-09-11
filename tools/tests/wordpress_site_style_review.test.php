<?php
// Isolated read-only inventory contract. No WordPress/database/network required.
define('ABSPATH', __DIR__);
function add_action(...$args) {}
function add_filter(...$args) {}
$allowed = true; $fixture = array(); $queries = 0; $preview = false; $front_page = false;
function is_admin() { return false; }
function is_feed() { return false; }
function is_embed() { return false; }
function is_front_page() { global $front_page; return $front_page; }
function is_page($ids) { return false; }
function is_preview() { global $preview; return $preview; }
function current_user_can($capability) { global $allowed; return $allowed && $capability === 'manage_options'; }
function get_posts($args) {
    global $fixture, $queries; $queries++;
    if ($args['numberposts'] !== 501 || $args['orderby'] !== 'ID' || $args['post_type'] !== array('page','post')) { throw new Exception('Inventory must stay bounded and page-scoped'); }
    return $fixture;
}
function wp_strip_all_tags($text) { return strip_tags($text); }
function get_permalink($id) { return 'https://example.test/?p=' . $id; }
function wp_die(...$args) { throw new RuntimeException('access denied'); }
function check_admin_referer(...$args) { throw new RuntimeException('nonce required'); }
require __DIR__ . '/../../wordpress-plugins/calorietoken-site-style/calorietoken-site-style.php';
use CalorieToken\SiteStyle\Review;
function check($value, $message) { if (!$value) { throw new Exception($message); } }
function post_fixture($id, $status, $content) {
    return (object) array('ID'=>$id, 'post_type'=>'page', 'post_status'=>$status, 'post_title'=>'<b>Page ' . $id . '</b>', 'post_content'=>$content);
}
$preview = true;
check(!\CalorieToken\SiteStyle\Plugin::enabled(), 'Preview must not load public styling');
$front_page = true;
check(!\CalorieToken\SiteStyle\Plugin::footer_only(), 'Front-page preview must not load public styling');
$preview = false;
check(\CalorieToken\SiteStyle\Plugin::footer_only(), 'Ordinary front page should retain shared styling');
$front_page = false;
check(\CalorieToken\SiteStyle\Plugin::enabled(), 'Ordinary public page should retain styling');
foreach (array('preview','customize_changeset_uuid','brizy-edit') as $query) {
    $_GET[$query] = '1';
    check(!\CalorieToken\SiteStyle\Plugin::enabled(), 'Editor/preview query must be excluded');
    unset($_GET[$query]);
}
$allowed = false;
check(Review::snapshot() === null && $queries === 0, 'Unauthorized inventory must not query content');
try { Review::export(); throw new Exception('Export should refuse anonymous callers'); } catch (RuntimeException $e) { check($e->getMessage() === 'access denied', 'Capability check must run first'); }
$allowed = true;
try { Review::export(); throw new Exception('Export requires a nonce'); } catch (RuntimeException $e) { check($e->getMessage() === 'nonce required', 'Nonce verification missing'); }
$fixture = array(post_fixture(1,'publish','CalorieApp V1 /integrated-exchange/'),post_fixture(2,'draft','private text must not be exported'),post_fixture(3,'private','sologenic.org livecoinwatch.com'));
$before = serialize($fixture); $report = Review::snapshot();
check(serialize($fixture) === $before, 'Inventory changed source data');
check(count($report['pages']) === 3 && !$report['truncated'], 'Inventory size incorrect');
check($report['counts'] === array('publish'=>1,'draft'=>1,'private'=>1), 'Status counts incorrect');
check($report['pages'][0]['url'] === 'https://example.test/?p=1', 'Published permalink missing');
check($report['pages'][1]['url'] === null && $report['pages'][2]['url'] === null, 'Unpublished URL leaked');
check(count($report['pages'][0]['source_flags']) === 2 && count($report['pages'][2]['source_flags']) === 2, 'Review markers missing');
check(strpos(json_encode($report), 'private text must not') === false, 'Raw private page content leaked');
check($report['pages'][0]['title'] === 'Page 1', 'Title not stripped');
$fixture = array_fill(0, 501, post_fixture(4,'draft',''));
$report = Review::snapshot();
check(count($report['pages']) === 500 && $report['truncated'], 'Partial inventory must be explicit');
echo "Site Style review: access, nonce, redaction, preserved data and bounded inventory passed.\n";

// The WordPress parser is a core dependency, not reimplemented here. These
// fixtures model its SCRIPT/attribute API and verify our scope and URL policy.
$site_url = 'https://calorietoken.net/'; $market_renderer = true;
function home_url($path = '/') { global $site_url; return $site_url; }
function wp_script_is($handle, $status = 'enqueued') {
    global $market_renderer;
    check(in_array($handle, array('calorieapp-identity-bridge-layout','calorieapp-identity-bridge-site-polish'), true), 'Unexpected renderer dependency');
    return $market_renderer;
}
class WP_HTML_Tag_Processor {
    public static $scripts = array();
    public static $last = null;
    public $nodes; private $index = -1;
    public function __construct($html) { $this->nodes = self::$scripts; self::$last = $this; }
    public function next_tag($tag) { check($tag === 'SCRIPT', 'Only scripts should be visited'); return ++$this->index < count($this->nodes); }
    public function get_attribute($name) { return isset($this->nodes[$this->index][$name]) ? $this->nodes[$this->index][$name] : null; }
    public function remove_attribute($name) { unset($this->nodes[$this->index][$name]); }
    public function set_attribute($name, $value) { $this->nodes[$this->index][$name] = $value; }
    public function get_updated_html() { return 'updated-public-markup'; }
}
$html = '<section>Public widget<script src="https://www.livecoinwatch.com/static/lcw-widget.js"></script></section>';
$targets = array('https://www.livecoinwatch.com/static/lcw-widget.js', 'https://livecoinwatch.com/static/lcw-widget.js?ver=1', '//www.livecoinwatch.com/static/lcw-widget.js');
$others = array('https://platform.twitter.com/widgets.js', 'https://livecoinwatch.com.example/static/lcw-widget.js',
    'https://www.livecoinwatch.com/static/other.js', 'https://other.example/lcw-widget.js',
    'https://user@www.livecoinwatch.com/static/lcw-widget.js', '/static/lcw-widget.js', null, true);
WP_HTML_Tag_Processor::$scripts = array_map(static function ($src) { return array('src'=>$src, 'type'=>'text/javascript', 'keep'=>'original'); }, array_merge($targets, $others));
$result = \CalorieToken\SiteStyle\Plugin::retire_market_loader($html);
check($result === 'updated-public-markup', 'Return the core parser output');
foreach (WP_HTML_Tag_Processor::$last->nodes as $index => $node) {
    if ($index < count($targets)) {
        check(!isset($node['src']) && $node['type'] === 'application/x-calorietoken-retired', 'The exact retired loader must not fetch or execute inline content');
        check($node['keep'] === 'original', 'Unrelated attributes remain intact');
    } else { check($node === WP_HTML_Tag_Processor::$scripts[$index], 'Unrelated scripts must stay unchanged'); }
}
$market_renderer = false;
check(\CalorieToken\SiteStyle\Plugin::retire_market_loader($html) === $html, 'Retain legacy loading when its replacement is unavailable');
$market_renderer = true; $preview = true;
check(\CalorieToken\SiteStyle\Plugin::retire_market_loader($html) === $html, 'Never filter editor previews');
$preview = false; $_GET['xl-return'] = '1';
check(\CalorieToken\SiteStyle\Plugin::retire_market_loader($html) === $html, 'Never filter Xaman return/action responses');
unset($_GET['xl-return']); $site_url = 'https://unrelated.example/';
check(\CalorieToken\SiteStyle\Plugin::retire_market_loader($html) === $html, 'Only the supported public site is filtered');
$site_url = 'https://calorietoken.net/'; $front_page = true;
check(\CalorieToken\SiteStyle\Plugin::retire_market_loader($html) === 'updated-public-markup', 'Home also retires the replaced loader');
$front_page = false;
echo "Market loader: exact URLs, inert output, renderer dependency and preview/auth/origin boundaries passed.\n";
