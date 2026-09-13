<?php
namespace CalorieToken\SiteStyle {
    function time() { return $GLOBALS['now']; }
    final class Plugin {
        const VERSION = 'test';
        public static function enabled() { return $GLOBALS['enabled']; }
    }
}
namespace {
    define('ABSPATH', __DIR__);
    $now = 1800000000; $enabled = true; $page = 6897;
    $options = array(); $cache = array(); $calls = array(); $responses = array(); $collision = false;
    function check($ok, $message) { if (!$ok) { throw new \RuntimeException($message); } }
    function add_action() {}
    function add_filter() {}
    function is_page($id) { return $id === $GLOBALS['page']; }
    function esc_attr($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
    function esc_html($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
    function get_transient($key) { return $GLOBALS['cache'][$key] ?? false; }
    function set_transient($key, $value, $ttl) { $GLOBALS['cache'][$key] = $value; check($ttl === 86400, 'Bound stale retention'); }
    function add_option($key, $value, $deprecated, $autoload) {
        check($autoload === false, 'Balance lock must not autoload on every page');
        if (isset($GLOBALS['options'][$key])) { return false; }
        $GLOBALS['options'][$key] = $value; return true;
    }
    function get_option($key) { return $GLOBALS['options'][$key] ?? false; }
    function wp_cache_delete() {}
    class MockDB {
        public $options = 'wp_options';
        public function update($table, $values, $where, $formats, $whereFormats) {
            if ($GLOBALS['collision']) { return 0; }
            if ($GLOBALS['options'][$where['option_name']] !== $where['option_value']) { return 0; }
            $GLOBALS['options'][$where['option_name']] = $values['option_value']; return 1;
        }
    }
    $wpdb = new MockDB();
    class WP_REST_Response {
        public $data; public $status; public $headers = array();
        public function __construct($data, $status) { $this->data = $data; $this->status = $status; }
        public function header($key, $value) { $this->headers[$key] = $value; }
    }
    class WP_HTML_Tag_Processor {
        private $html;
        public function __construct($html) { $this->html = $html; }
        public function next_tag($tag) { return preg_match('~<img\b[^>]*>~i', $this->html) === 1; }
        public function get_attribute($name) {
            preg_match('~<img\b[^>]*>~i', $this->html, $img);
            preg_match('~\b' . $name . '="([^"]*)"~', $img[0], $m);
            return $m[1] ?? null;
        }
    }
    function wp_json_encode($value) { return json_encode($value); }
    function is_wp_error($value) { return $value === false; }
    function wp_remote_retrieve_response_code($response) { return $response['code']; }
    function wp_remote_retrieve_body($response) { return json_encode(array('result' => $response['result'])); }
    function wp_safe_remote_post($url, $request) {
        $GLOBALS['calls'][] = $url;
        check(in_array($url, array('https://xrplcluster.com/', 'https://honeycluster.io/'), true), 'Only fixed Mainnet providers');
        $body = json_decode($request['body'], true);
        check($body === array('method' => 'account_info', 'params' => array(array('account' => \CalorieToken\SiteStyle\Donations::WALLET, 'ledger_index' => 'validated'))), 'Fixed read-only request');
        check($request['timeout'] === 4 && $request['redirection'] === 0, 'Bounded upstream request');
        check(!isset($request['cookies']), 'No visitor cookies sent upstream');
        return array_shift($GLOBALS['responses']) ?? false;
    }
    require __DIR__ . '/../../wordpress-plugins/calorietoken-site-style/donations.php';
    use CalorieToken\SiteStyle\Donations;
    function good($balance = '12345678', $ledger = 100) {
        return array('code' => 200, 'result' => array('validated' => true, 'ledger_index' => $ledger,
            'account_data' => array('Account' => Donations::WALLET, 'Balance' => $balance)));
    }

    $responses = array(good()); $r = Donations::balance();
    check($r->status === 200 && $r->data['balanceDrops'] === '12345678' && $r->data['status'] === 'current', 'Verified balance');
    Donations::balance(); check(count($calls) === 1, 'Reuse one cached ledger lookup');
    $now += 61; $responses = array(false, false); $r = Donations::balance();
    check($r->data['status'] === 'stale' && $r->data['balanceDrops'] === '12345678', 'Failed update preserves last measurement');
    Donations::balance(); check(count($calls) === 3, 'Failures also have a shared cooldown');
    $now += 61; $collision = true; Donations::balance();
    check(count($calls) === 3, 'Concurrent refresh ownership prevents another upstream request'); $collision = false;
    $wrong = good('9999'); $wrong['result']['account_data']['Account'] = 'wrong';
    $responses = array($wrong, good('12345677', 101)); $r = Donations::balance();
    check($r->data['balanceDrops'] === '12345677' && count($calls) === 5, 'Reject wrong wallet and use validated fallback');
    $now += 61; $bad = good(); $bad['result']['validated'] = false;
    $responses = array($bad, good('12345679', 99)); $r = Donations::balance();
    check($r->data['status'] === 'stale' && $r->data['ledgerIndex'] === 101, 'Reject unvalidated and regressing ledger data');
    $now += 61; $responses = array(good('<script>'), good('100000000000000001')); $r = Donations::balance();
    check($r->data['balanceDrops'] === '12345677', 'Reject malformed or impossible balance');
    $cache = array(); $now += 61; $responses = array(false, false); $r = Donations::balance();
    check($r->status === 503 && $r->data['balanceDrops'] === null && $r->data['status'] === 'unavailable', 'No measurement is never zero');
    $now += 61; $responses = array(good('0', 102)); $r = Donations::balance();
    check($r->status === 200 && $r->data['balanceDrops'] === '0', 'Real zero is a valid measurement');
    $now += 86401; $r = Donations::balance();
    check($r->data['balanceDrops'] === null, 'Discard measurements older than a day');

    $widget = '<div class="brz-image" data-brz-custom-id="cgdzzmytepqaufioqeqsxzvvlrdmehfyabrx"><picture><source srcset="image.png"><img title="progressbar" src="https://calorietoken.net/wp-content/uploads/2024/10/progressbar-1568x449.png"></picture></div>';
    $form = '<form id="unchanged"><input name="donation" value="0.01"><button>Donate</button></form>';
    $html = $form . $widget; $out = Donations::replace_meter($html);
    check(strpos($out, 'id="ctstyle-donation-balance"') !== false && strpos($out, 'progressbar-1568') === false, 'Replace the identified old image server-side');
    check(strpos($out, $form) === 0, 'Preserve payment controls exactly');
    check(Donations::replace_meter($out) === $out, 'Idempotent rendering');
    check(Donations::replace_meter($html . $widget) === $html . $widget, 'Ambiguous duplicate remains untouched');
    $custom = str_replace('title="progressbar"', 'title="custom"', $html);
    check(Donations::replace_meter($custom) === $custom, 'Preserve a changed widget');
    $page = 6914; check(Donations::replace_meter($html) === $html, 'Leave product and checkout untouched');
    $page = 6897; $enabled = false; check(Donations::replace_meter($html) === $html, 'Leave editor and previews untouched');
    echo "Donation balance: validated data, cache, concurrency, failure states and scoped replacement passed.\n";
}
