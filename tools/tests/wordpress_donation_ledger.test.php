<?php
namespace CalorieToken\SiteStyle {
    function time() { return $GLOBALS['now']; }
    final class Donations {
        const WALLET = 'rEfiRssDCQd466z2bi63vi64u2rYiMrnhL';
        public static function claim_refresh() { return $GLOBALS['lease']; }
    }
}
namespace {
    define('ABSPATH', __DIR__);
    $now = 1789231800; $lease = true; $options = array(); $rows = array(); $notes = array(); $responses = array(); $requests = array();
    function check($ok, $message) { if (!$ok) { throw new \RuntimeException($message); } }
    function add_action() {}
    function add_filter() {}
    function get_option($key) { return $GLOBALS['options'][$key] ?? false; }
    function update_option($key, $value, $autoload) { check($autoload === false, 'Bookkeeping must not autoload'); $GLOBALS['options'][$key] = $value; }
    function wc_get_order_notes($args) { return $GLOBALS['notes']; }
    function wc_get_orders($args) {
        check($args['limit'] === 3 && $args['date_paid'] === '>=' . \CalorieToken\SiteStyle\DonationLedger::BASE_AT, 'Bounded scan anchored at opening date');
        return (object) array('orders' => $GLOBALS['orders'], 'max_num_pages' => 1);
    }
    function wp_json_encode($value) { return json_encode($value); }
    function is_wp_error($value) { return $value === false; }
    function wp_remote_retrieve_response_code($r) { return $r['code']; }
    function wp_remote_retrieve_body($r) { return json_encode(array('result' => $r['result'])); }
    function wp_safe_remote_post($url, $request) {
        check(in_array($url, array('https://xrplcluster.com/', 'https://honeycluster.io/'), true), 'Only fixed Mainnet sources');
        $body = json_decode($request['body'], true);
        check($body['method'] === 'tx' && $body['params'][0]['binary'] === false, 'Read-only transaction lookup');
        check($request['timeout'] === 4 && $request['redirection'] === 0 && !isset($request['cookies']), 'Bounded request without user credentials');
        $GLOBALS['requests'][] = $body;
        return array_shift($GLOBALS['responses']) ?? false;
    }
    class DB {
        public $prefix = 'wp_'; public $broken = false;
        public function prepare($sql, ...$args) { return array($sql, $args); }
        public function get_var($query) {
            if ($this->broken) { return null; }
            if (is_array($query)) { foreach ($GLOBALS['rows'] as $row) { if ($row['order'] === $query[1][0]) { return $row['hash']; } } return null; }
            $total = '0'; foreach ($GLOBALS['rows'] as $row) { $total = \CalorieToken\SiteStyle\DonationLedger::add_drops($total, $row['drops']); } return $total;
        }
        public function query($query) {
            [$sql,$args] = $query;
            if (strpos($sql,'UPDATE IGNORE') === 0) {
                foreach ($GLOBALS['rows'] as &$row) { if ($row['hash'] === $args[1] && $row['order'] === null) { $row['order']=$args[0]; return 1; } }
                return 0;
            }
            [$hash,$ledger,$drops] = $args;
            $order = strpos($sql, 'NULL') === false ? $args[3] : null;
            foreach ($GLOBALS['rows'] as $row) { if ($row['hash'] === $hash || ($order !== null && $row['order'] === $order)) { return 0; } }
            $GLOBALS['rows'][] = array('hash'=>$hash,'ledger'=>$ledger,'drops'=>$drops,'order'=>$order); return 1;
        }
    }
    $wpdb = new DB();
    class Order {
        public $id = 9001; public $hash = ''; public $status = 'completed'; public $currency = 'XRP'; public $method = 'xumm'; public $product = 6914;
        public function get_id() { return $this->id; }
        public function get_transaction_id() { return $this->hash; }
        public function get_payment_method() { return $this->method; }
        public function get_currency() { return $this->currency; }
        public function get_status() { return $this->status; }
        public function get_date_paid() { return new \DateTimeImmutable('@1789231700'); }
        public function get_items() { return array(new Item($this->product)); }
    }
    class Item { private $id; public function __construct($id) { $this->id=$id; } public function get_product_id() { return $this->id; } }
    require __DIR__ . '/../../wordpress-plugins/calorietoken-site-style/donation-ledger.php';
    use CalorieToken\SiteStyle\DonationLedger as Ledger;
    use CalorieToken\SiteStyle\Donations;
    $hash = str_repeat('A',64);
    function payment($hash, $drops = '10000000') {
        return array('validated'=>true,'hash'=>$hash,'TransactionType'=>'Payment','Account'=>'rDifferentSender',
            'Destination'=>Donations::WALLET,'ledger_index'=>Ledger::BASE_LEDGER+1,'Amount'=>'999999999999',
            'meta'=>array('TransactionResult'=>'tesSUCCESS','delivered_amount'=>$drops),
            'Memos'=>array(array('Memo'=>array('MemoData'=>strtoupper(bin2hex('Order id: 9001, paid with XUMM'))))));
    }
    check(Ledger::snapshot() === null, 'Uninitialised register never reports zero received');
    $options[Ledger::VERSION] = '1';
    check(Ledger::snapshot()['totalDrops'] === '401268984', 'Permanent opening amount');
    $r = payment($hash); $v = Ledger::verified_payment($r,$hash,9001);
    check($v['drops'] === '10000000', 'Count delivered XRP, never the requested maximum');
    check(Ledger::verified_payment($r,$hash,9002) === null, 'Order memo must match the donation receipt');
    foreach (array(
        array('validated', false), array('TransactionType','OfferCreate'), array('Destination','wrong'),
        array('Account',Donations::WALLET), array('hash',str_repeat('B',64)), array('ledger_index',Ledger::BASE_LEDGER)
    ) as [$key,$value]) { $bad=$r; $bad[$key]=$value; check(Ledger::verified_payment($bad,$hash) === null,'Exclude wrong, outgoing, unvalidated or pre-opening transfer: '.$key); }
    foreach (array('unavailable','0','-1','1.5','100000000000000001',array('currency'=>'USD','value'=>'10')) as $value) {
        $bad=$r; $bad['meta']['delivered_amount']=$value; check(Ledger::verified_payment($bad,$hash) === null,'Only actual positive native XRP');
    }
    $bad=$r; $bad['meta']['TransactionResult']='tecFAILED'; check(Ledger::verified_payment($bad,$hash) === null,'Failed payments do not count');
    check(Ledger::record($v,9001), 'Record verified donation');
    Ledger::record($v,9001); Ledger::record($v,0,7);
    $duplicate=$v; $duplicate['tx_hash']=str_repeat('B',64); Ledger::record($duplicate,9001);
    check(count($rows)===1 && Ledger::snapshot()['totalDrops']==='411268984','Retries, same order and manual resubmission count once');
    $wallet_after_spending = '1000000';
    check(Ledger::snapshot()['totalDrops']==='411268984','Outgoing funds and wallet balance cannot reduce received support');
    $wpdb->broken=true; check(Ledger::snapshot()===null,'Broken database cannot reset a permanent total'); $wpdb->broken=false;
    check(Ledger::add_drops('999999999999999999999999','1')==='1000000000000000000000000','Cumulative totals remain exact above native integer range');

    $order=new Order();
    $notes=array((object)array('date_created'=>new \DateTimeImmutable('@1789231701'),
        'content'=>'Hi, your order is paid! Thank you! <a href="https://bithomp.com/explorer/'.$hash.'">information</a>'));
    check(Ledger::receipt_hash($order)===$hash,'Support the installed gateway receipt without a stored transaction ID');
    $notes[0]->date_created=new \DateTimeImmutable('@1789231699'); check(Ledger::receipt_hash($order)===null,'Older failed-attempt receipts cannot count');
    $notes=array(); $order->hash=$hash;
    check(Ledger::receipt_hash($order)===$hash,'Support native transaction ID too');
    foreach (array(array('status','pending'),array('product',77),array('currency','USD'),array('method','other')) as [$key,$value]) {
        $bad=clone $order; $bad->$key=$value; check(Ledger::receipt_hash($bad)===null,'Only paid XRP donation-product orders');
    }

    $rows=array(); $orders=array($order); $responses=array(array('code'=>200,'result'=>$r));
    Ledger::reconcile(); check(count($rows)===1 && count($requests)===1,'Background reconciliation verifies and records the donation');
    Ledger::reconcile(); check(count($requests)===1,'Already recorded orders require no network request');
    $lease=false; $rows=array(); Ledger::reconcile(); check(count($requests)===1,'Concurrent worker cannot duplicate lookups'); $lease=true;
    $oldChecked=$options[Ledger::SCAN]['checkedAt']; $now+=300;
    $responses=array(false,false); Ledger::reconcile();
    check(!$rows && $options[Ledger::SCAN]['checkedAt']===$oldChecked,'Provider failures add nothing and do not claim a fresh reconciliation');
    echo "Cumulative donations: fixed baseline, delivered XRP, outgoing/failed exclusions, native receipts, deduplication, durable totals and bounded reconciliation passed.\n";
}
