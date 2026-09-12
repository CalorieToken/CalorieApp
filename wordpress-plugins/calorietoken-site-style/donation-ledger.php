<?php
/** Cumulative support register. Read-only XRPL lookups; never initiates a payment. */
namespace CalorieToken\SiteStyle;
if (!defined('ABSPATH')) { exit; }

final class DonationLedger {
    // User-designated opening support, observed before this accounting change.
    // Never reset this anchor from a later wallet balance or a cache miss.
    const BASE_DROPS = '401268984';
    const BASE_LEDGER = 106938803;
    const BASE_AT = 1789231051; // 2026-09-12 16:37:31 UTC, observation time.
    const VERSION = 'ctstyle_donation_register_v1';
    const SCAN = 'ctstyle_donation_order_scan_v1';
    const EVENT = 'ctstyle_donation_reconcile';

    private static function table() { global $wpdb; return $wpdb->prefix . 'ctstyle_donations'; }

    public static function install() {
        if (!current_user_can('manage_options') && !current_user_can('manage_woocommerce')) { return; }
        if (get_option(self::VERSION) !== '1') {
            global $wpdb;
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            $table = self::table();
            dbDelta("CREATE TABLE $table (
                tx_hash char(64) NOT NULL,
                ledger_index bigint(20) unsigned NOT NULL,
                drops decimal(30,0) NOT NULL,
                order_id bigint(20) unsigned DEFAULT NULL,
                reviewed_by bigint(20) unsigned NOT NULL DEFAULT 0,
                recorded_at bigint(20) unsigned NOT NULL,
                PRIMARY KEY  (tx_hash),
                UNIQUE KEY donation_order (order_id)
            ) " . $wpdb->get_charset_collate() . ';');
            if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table))) !== $table) { return; }
            update_option(self::VERSION, '1', false);
        }
        if (!wp_next_scheduled(self::EVENT)) { wp_schedule_event(time() + 5, 'ctstyle_five_minutes', self::EVENT); }
    }

    public static function intervals($schedules) {
        $schedules['ctstyle_five_minutes'] = array('interval' => 300, 'display' => 'CalorieToken donation reconciliation');
        return $schedules;
    }

    public static function queue() {
        if (!wp_next_scheduled(self::EVENT . '_soon')) { wp_schedule_single_event(time() + 10, self::EVENT . '_soon'); }
    }

    public static function add_drops($a, $b) {
        // Exact decimal arithmetic without requiring BCMath or converting to float.
        $out = ''; $carry = 0; $i = strlen($a) - 1; $j = strlen($b) - 1;
        while ($i >= 0 || $j >= 0 || $carry) {
            $sum = ($i >= 0 ? (int) $a[$i--] : 0) + ($j >= 0 ? (int) $b[$j--] : 0) + $carry;
            $out = ($sum % 10) . $out; $carry = intdiv($sum, 10);
        }
        return ltrim($out, '0') ?: '0';
    }

    public static function snapshot() {
        if (get_option(self::VERSION) !== '1') { return null; }
        global $wpdb;
        $sum = $wpdb->get_var('SELECT COALESCE(SUM(drops),0) FROM ' . self::table());
        // Missing/unreadable bookkeeping must never silently reset the total.
        if (!is_string($sum) || !preg_match('/^(0|[1-9][0-9]{0,29})$/D', $sum)) { return null; }
        $scan = get_option(self::SCAN);
        return array('cumulative' => true, 'startingDrops' => self::BASE_DROPS,
            'newDonationDrops' => $sum, 'totalDrops' => self::add_drops(self::BASE_DROPS, $sum),
            'baselineLedger' => self::BASE_LEDGER, 'baselineAt' => self::BASE_AT,
            'donationsCheckedAt' => is_array($scan) ? (int) ($scan['checkedAt'] ?? 0) : 0);
    }

    public static function verified_payment($r, $hash, $order_id = 0) {
        if (!is_array($r) || !empty($r['error']) || ($r['validated'] ?? false) !== true ||
            ($r['hash'] ?? '') !== $hash || ($r['TransactionType'] ?? '') !== 'Payment' ||
            ($r['Destination'] ?? '') !== Donations::WALLET || !is_string($r['Account'] ?? null) ||
            $r['Account'] === Donations::WALLET || ($r['meta']['TransactionResult'] ?? '') !== 'tesSUCCESS' ||
            !is_int($r['ledger_index'] ?? null) || $r['ledger_index'] <= self::BASE_LEDGER) { return null; }
        $drops = $r['meta']['delivered_amount'] ?? null;
        if (!is_string($drops) || !preg_match('/^[1-9][0-9]{0,17}$/D', $drops) ||
            (strlen($drops) === 18 && strcmp($drops, '100000000000000000') > 0)) { return null; }
        if ($order_id) {
            // The existing gateway already places this order reference on-chain.
            // Do not add new memos or publish any extra customer/order information.
            $matched = false;
            foreach (($r['Memos'] ?? array()) as $memo) {
                $hex = $memo['Memo']['MemoData'] ?? '';
                if (is_string($hex) && strlen($hex) <= 2048 && strlen($hex) % 2 === 0 && ctype_xdigit($hex) &&
                    strpos(hex2bin($hex), 'Order id: ' . $order_id . ', ') === 0) { $matched = true; }
            }
            if (!$matched) { return null; }
        }
        return array('tx_hash' => $hash, 'ledger_index' => $r['ledger_index'], 'drops' => $drops);
    }

    public static function lookup($hash, $order_id = 0) {
        if (!is_string($hash) || !preg_match('/^[A-F0-9]{64}$/D', $hash)) { return null; }
        foreach (array('https://xrplcluster.com/', 'https://honeycluster.io/') as $endpoint) {
            $response = wp_safe_remote_post($endpoint, array('timeout' => 4, 'redirection' => 0,
                'limit_response_size' => 65536,
                'headers' => array('Content-Type' => 'application/json', 'Accept' => 'application/json'),
                'body' => wp_json_encode(array('method' => 'tx', 'params' => array(array(
                    'transaction' => $hash, 'binary' => false, 'api_version' => 1))))));
            if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) { continue; }
            $body = json_decode(wp_remote_retrieve_body($response), true);
            $verified = self::verified_payment($body['result'] ?? null, $hash, $order_id);
            if ($verified) { return $verified; }
        }
        return null;
    }

    public static function receipt_hash($order) {
        if (!$order || $order->get_payment_method() !== 'xumm' || $order->get_currency() !== 'XRP' ||
            !in_array($order->get_status(), array('processing', 'completed', 'refunded'), true) ||
            !$order->get_date_paid() || !$order->get_items()) { return null; }
        foreach ($order->get_items() as $item) { if ((int) $item->get_product_id() !== 6914) { return null; } }
        $hash = strtoupper((string) $order->get_transaction_id());
        if (preg_match('/^[A-F0-9]{64}$/D', $hash)) { return $hash; }
        // The installed gateway calls payment_complete() without a transaction ID,
        // then writes a customer receipt containing the explorer link. Read that
        // existing receipt; independently verify its hash and order memo on Mainnet.
        foreach (wc_get_order_notes(array('order_id' => $order->get_id(), 'type' => 'customer', 'limit' => 10)) as $note) {
            if (!$note->date_created || $note->date_created->getTimestamp() < $order->get_date_paid()->getTimestamp()) { continue; }
            if (preg_match('~href=["\']https://[^"\'<>\s]*[/=]([a-fA-F0-9]{64})(?:[?#][^"\'<>\s]*)?["\']~', $note->content, $m)) {
                return strtoupper($m[1]);
            }
        }
        return null;
    }

    public static function record($verified, $order_id = 0, $reviewer = 0) {
        global $wpdb;
        $table = self::table();
        // One row per transaction and one automatic receipt per order. Concurrent
        // callbacks, cron retries, reloads and manual resubmission cannot double count.
        $sql = $wpdb->prepare("INSERT IGNORE INTO $table (tx_hash,ledger_index,drops,order_id,reviewed_by,recorded_at)
            VALUES (%s,%d,%s," . ($order_id ? '%d' : 'NULL') . ',%d,%d)',
            ...array_merge(array($verified['tx_hash'], $verified['ledger_index'], $verified['drops']),
                $order_id ? array($order_id) : array(), array($reviewer, time())));
        $result = $wpdb->query($sql);
        if ($result === 0 && $order_id) {
            // A previously approved direct receipt may later be matched to its
            // website order. Link it without changing its amount or counting again.
            $wpdb->query($wpdb->prepare("UPDATE IGNORE $table SET order_id=%d WHERE tx_hash=%s AND order_id IS NULL", $order_id, $verified['tx_hash']));
        }
        return $result !== false;
    }

    public static function reconcile() {
        if (get_option(self::VERSION) !== '1' || !function_exists('wc_get_orders') ||
            !Donations::claim_refresh(time(), 'ctstyle_donation_orders_lock_v1', 90)) { return; }
        $scan = get_option(self::SCAN);
        $scan = is_array($scan) ? $scan : array('page' => 1, 'checkedAt' => 0, 'failed' => false);
        $page = max(1, (int) $scan['page']);
        // Three orders per background run; no order queries or transaction lookups
        // on the visitor request and no scan of donors' wallet histories.
        $result = wc_get_orders(array('type' => 'shop_order', 'status' => array('processing','completed','refunded'),
            'payment_method' => 'xumm', 'date_paid' => '>=' . self::BASE_AT,
            'limit' => 3, 'page' => $page, 'paginate' => true, 'orderby' => 'date', 'order' => 'ASC'));
        if (!is_object($result) || !isset($result->orders, $result->max_num_pages)) { return; }
        global $wpdb; $table = self::table();
        foreach ($result->orders as $order) {
            // Other merchandise is not a donation and must not make this scan stale.
            $items = $order->get_items(); $donation = !empty($items) && $order->get_currency() === 'XRP';
            foreach ($items as $item) { if ((int) $item->get_product_id() !== 6914) { $donation = false; } }
            if (!$donation) { continue; }
            if ($wpdb->get_var($wpdb->prepare("SELECT tx_hash FROM $table WHERE order_id=%d", $order->get_id()))) { continue; }
            $hash = self::receipt_hash($order);
            $verified = $hash ? self::lookup($hash, $order->get_id()) : null;
            if (!$verified || !self::record($verified, $order->get_id())) { $scan['failed'] = true; }
        }
        $scan['page'] = $page < (int) $result->max_num_pages ? $page + 1 : 1;
        if ($scan['page'] === 1) {
            if (!$scan['failed']) { $scan['checkedAt'] = time(); }
            $scan['failed'] = false;
        }
        update_option(self::SCAN, $scan, false);
    }

    public static function menu() {
        add_management_page('Donatieregister', 'Donatieregister', 'manage_woocommerce', 'ctstyle-donations', array(self::class, 'admin'));
    }

    private static function display_xrp($drops) {
        $padded = str_pad($drops, 7, '0', STR_PAD_LEFT);
        $whole = preg_replace('/\B(?=(\d{3})+(?!\d))/', '.', substr($padded, 0, -6));
        return $whole . ',' . str_pad(rtrim(substr($padded, -6), '0'), 2, '0') . ' XRP';
    }

    public static function admin() {
        if (!current_user_can('manage_woocommerce')) { return; }
        self::install();
        echo '<div class="wrap"><h1>Donatieregister</h1><p>Vast startbedrag: <strong>401,268984 XRP</strong>, gecontroleerd op 12 september 2026 om 16:37:31 UTC (ledger 106938803).</p>';
        echo '<p>Nieuwe betaalde website-donaties worden op de achtergrond gecontroleerd op het XRP Ledger. Alleen de donatiebijdrage, met een passend betaalbewijs voor de consolidatiewallet, telt mee. Uitgaven en kosten worden niet afgetrokken.</p>';
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            check_admin_referer('ctstyle-donation-add');
            $hash = isset($_POST['tx_hash']) && is_string($_POST['tx_hash']) ? strtoupper(trim(wp_unslash($_POST['tx_hash']))) : '';
            $verified = ($_POST['confirmed_donation'] ?? '') === '1' ? self::lookup($hash) : null;
            $ok = $verified && self::record($verified, 0, get_current_user_id());
            echo '<div class="notice ' . ($ok ? 'notice-success' : 'notice-error') . '"><p>' .
                ($ok ? 'Donatie vastgelegd. Een al geregistreerde transactie wordt niet dubbel geteld.' : 'Niet toegevoegd: geen nieuwe, gevalideerde XRP-betaling naar deze wallet aangetoond. Controleer de transactie of probeer later opnieuw.') . '</p></div>';
        }
        $s = self::snapshot();
        if ($s) { echo '<p>Totaal ontvangen steun: <strong>' . esc_html(self::display_xrp($s['totalDrops'])) . '</strong></p>'; }
        echo '<h2>Een rechtstreekse donatie toevoegen</h2><p>Controleer eerst of dit werkelijk nieuwe vrijwillige steun is. Eigen terugboekingen, verplaatste projectmiddelen en wisseltransacties horen hier niet bij. Het adres alleen bewijst het doel van een overboeking niet.</p><form method="post">';
        wp_nonce_field('ctstyle-donation-add');
        echo '<p>Open de betaling in <a href="https://bithomp.com/explorer/' . esc_attr(Donations::WALLET) . '" target="_blank" rel="noopener noreferrer">de walletverkenner</a> en kopieer de volledige transactie-ID.</p><label for="ctstyle-tx-hash">Transactie-ID</label><br><input id="ctstyle-tx-hash" name="tx_hash" type="text" pattern="[a-fA-F0-9]{64}" maxlength="64" size="68" style="max-width:100%" required autocomplete="off"><p><label><input type="checkbox" name="confirmed_donation" value="1" required> Ik heb gecontroleerd dat dit een nieuwe donatie is.</label></p>';
        submit_button('Gecontroleerde donatie toevoegen'); echo '</form>';
        echo '<h2>Laatste geregistreerde bijdragen</h2><table class="widefat striped"><thead><tr><th>Transactie</th><th>Bedrag</th><th>Controle</th></tr></thead><tbody>';
        global $wpdb;
        $rows = $wpdb->get_results('SELECT tx_hash,drops,order_id FROM ' . self::table() . ' ORDER BY recorded_at DESC LIMIT 30') ?: array();
        if (!$rows) { echo '<tr><td colspan="3">Nog geen nieuwe donaties geregistreerd sinds het startmoment.</td></tr>'; }
        foreach ($rows as $row) {
            echo '<tr><td><a href="https://bithomp.com/explorer/' . esc_attr($row->tx_hash) . '" target="_blank" rel="noopener noreferrer"><code>' . esc_html(substr($row->tx_hash, 0, 12)) . '…</code></a></td><td>' . esc_html(self::display_xrp($row->drops)) . '</td><td>' . ($row->order_id ? 'Website-donatie' : 'Handmatig gecontroleerd') . '</td></tr>';
        }
        echo '</tbody></table><p>Dit register bevat geen namen of e-mailadressen. Neem de eigen tabel met het achtervoegsel <code>ctstyle_donations</code> mee in databaseback-ups. De openbare teller toont alleen bedragen en controletijdstippen.</p></div>';
    }
}
add_filter('cron_schedules', array(DonationLedger::class, 'intervals'));
add_action('admin_init', array(DonationLedger::class, 'install'));
add_action('admin_menu', array(DonationLedger::class, 'menu'));
add_action(DonationLedger::EVENT, array(DonationLedger::class, 'reconcile'));
add_action(DonationLedger::EVENT . '_soon', array(DonationLedger::class, 'reconcile'));
add_action('woocommerce_payment_complete', array(DonationLedger::class, 'queue'));
add_action('woocommerce_order_status_completed', array(DonationLedger::class, 'queue'));
