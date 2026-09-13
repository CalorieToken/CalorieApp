<?php
/** Public donation total with a separate cached wallet balance. */
namespace CalorieToken\SiteStyle;

if (!defined('ABSPATH')) { exit; }

final class Donations {
    const WALLET = 'rEfiRssDCQd466z2bi63vi64u2rYiMrnhL';
    const CACHE = 'ctstyle_donation_balance_v1';
    const LOCK = 'ctstyle_donation_refresh_v1';
    const INTERVAL = 60;

    public static function register() {
        register_rest_route('calorietoken/v1', '/donation-balance', array(
            'methods' => 'GET', 'permission_callback' => '__return_true',
            'callback' => array(self::class, 'balance'),
        ));
    }

    private static function copy() {
        static $copy;
        if ($copy === null) {
            $copy = json_decode((string) file_get_contents(__DIR__ . '/assets/donations-data.json'), true);
        }
        return is_array($copy) ? $copy : array();
    }

    public static function enqueue() {
        if (!Plugin::enabled() || !is_page(6897)) { return; }
        $base = plugin_dir_url(__FILE__);
        wp_enqueue_style('calorietoken-donations', $base . 'assets/donations.css', array('calorietoken-menu-pages'), Plugin::VERSION);
        wp_enqueue_script('calorietoken-donations', $base . 'assets/donations.js', array('calorietoken-content-language'), Plugin::VERSION, true);
        wp_localize_script('calorietoken-donations', 'CalorieTokenDonations', array(
            'endpoint' => esc_url_raw(rest_url('calorietoken/v1/donation-balance')),
            'wallet' => self::WALLET, 'copy' => self::copy(), 'interval' => self::INTERVAL,
        ));
    }

    public static function replace_meter($html) {
        if (!is_string($html) || !Plugin::enabled() || !is_page(6897) ||
            strpos($html, 'cgdzzmytepqaufioqeqsxzvvlrdmehfyabrx') === false ||
            strpos($html, 'id="ctstyle-donation-balance"') !== false) { return $html; }
        // Match only the verified legacy image widget, never its neighbouring
        // donation text, amount controls, cart, account card or editor content.
        $pattern = '~<div\b(?=[^>]*\bdata-brz-custom-id=(["\'])cgdzzmytepqaufioqeqsxzvvlrdmehfyabrx\1)[^>]*>\s*<picture\b[^>]*>(?:\s*<source\b[^>]*>)*\s*<img\b[^>]*>\s*</picture>\s*</div>~i';
        if (preg_match_all($pattern, $html, $matches) !== 1) { return $html; }
        $tags = new \WP_HTML_Tag_Processor($matches[0][0]);
        if (!$tags->next_tag('IMG') || $tags->get_attribute('title') !== 'progressbar') { return $html; }
        $src = $tags->get_attribute('src');
        $url = is_string($src) ? parse_url($src) : false;
        if (!$url || !isset($url['host'], $url['path']) ||
            !in_array(strtolower($url['host']), array('calorietoken.net', 'www.calorietoken.net'), true) ||
            !preg_match('~/uploads/2024/10/progressbar(?:-\d+x\d+)?\.png$~', $url['path'])) { return $html; }
        return str_replace($matches[0][0], self::markup(), $html);
    }

    private static function markup() {
        $all = self::copy();
        $locale = isset($_GET['ui_lang']) && is_string($_GET['ui_lang']) && isset($all[$_GET['ui_lang']]) ? $_GET['ui_lang'] : 'en';
        $c = $all[$locale];
        ob_start();
        ?>
        <section id="ctstyle-donation-balance" class="ctstyle-donation-balance" lang="<?php echo esc_attr($locale); ?>" dir="<?php echo in_array($locale, array('ar', 'ur'), true) ? 'rtl' : 'ltr'; ?>" aria-labelledby="ctstyle-donation-balance-title">
            <p class="ctstyle-donation-eyebrow" data-donation-copy="eyebrow"><?php echo esc_html($c['eyebrow']); ?></p>
            <h2 id="ctstyle-donation-balance-title" data-donation-copy="title"><?php echo esc_html($c['title']); ?></h2>
            <p class="ctstyle-donation-amount"><strong data-donation-amount>—</strong> <span>XRP</span></p>
            <p class="ctstyle-donation-status" data-donation-status role="status" aria-live="polite"><?php echo esc_html($c['loading']); ?></p>
            <p data-donation-copy="description"><?php echo esc_html($c['description']); ?></p>
            <div class="ctstyle-donation-meta">
                <p><span data-donation-copy="updated"><?php echo esc_html($c['updated']); ?></span> <time data-donation-time>—</time></p>
                <p data-donation-copy="refreshNote"><?php echo esc_html($c['refreshNote']); ?></p>
            </div>
            <details><summary data-donation-copy="details"><?php echo esc_html($c['details']); ?></summary>
                <p class="ctstyle-donation-note" data-donation-copy="note"><?php echo esc_html($c['note']); ?></p>
                <p><span data-donation-copy="openingLabel"><?php echo esc_html($c['openingLabel']); ?></span> <strong data-donation-opening>401.268984</strong> XRP<br><time data-donation-baseline-time datetime="2026-09-12T16:37:31Z">2026-09-12 · 16:37:31 UTC</time></p>
                <p><span data-donation-copy="addedLabel"><?php echo esc_html($c['addedLabel']); ?></span> <strong data-donation-added>—</strong> XRP</p>
                <p><span data-donation-copy="walletBalanceLabel"><?php echo esc_html($c['walletBalanceLabel']); ?></span> <strong data-donation-wallet-amount>—</strong> XRP<br><span data-donation-copy="walletNote"><?php echo esc_html($c['walletNote']); ?></span></p>
                <p><span data-donation-copy="walletUpdated"><?php echo esc_html($c['walletUpdated']); ?></span> <time data-donation-wallet-time>—</time></p>
                <p><span data-donation-copy="walletLabel"><?php echo esc_html($c['walletLabel']); ?></span><br><code dir="ltr"><?php echo esc_html(self::WALLET); ?></code></p>
                <p><span data-donation-copy="ledger"><?php echo esc_html($c['ledger']); ?></span> <span data-donation-ledger>—</span></p>
                <a href="https://bithomp.com/explorer/<?php echo esc_attr(self::WALLET); ?>" target="_blank" rel="noopener noreferrer" data-donation-copy="explorer"><?php echo esc_html($c['explorer']); ?></a>
            </details>
            <noscript><p><?php echo esc_html($c['noScript']); ?></p></noscript>
        </section>
        <?php
        return ob_get_clean();
    }

    public static function claim_refresh($now, $key = self::LOCK, $interval = self::INTERVAL) {
        // Atomic lease shared by all visitors, also without persistent object
        // caching. A slow/unavailable upstream cannot trigger a request storm.
        $until = (string) ($now + $interval);
        if (add_option($key, $until, '', false)) { return true; }
        $old = get_option($key);
        if (!is_scalar($old) || (int) $old > $now) { return false; }
        global $wpdb;
        $changed = $wpdb->update($wpdb->options, array('option_value' => $until),
            array('option_name' => $key, 'option_value' => (string) $old), array('%s'), array('%s', '%s'));
        if ($changed === 1) { wp_cache_delete($key, 'options'); return true; }
        return false;
    }

    public static function balance() {
        $now = time();
        $saved = get_transient(self::CACHE);
        if (!is_array($saved) || !isset($saved['wallet'], $saved['checkedAt'], $saved['balanceDrops'], $saved['ledgerIndex']) ||
            $saved['wallet'] !== self::WALLET || $saved['checkedAt'] > $now || $now - $saved['checkedAt'] >= 86400) { $saved = null; }
        $fresh = $saved && $now - $saved['checkedAt'] < self::INTERVAL;
        if (!$fresh && self::claim_refresh($now)) {
            foreach (array('https://xrplcluster.com/', 'https://honeycluster.io/') as $endpoint) {
                $response = wp_safe_remote_post($endpoint, array(
                    'timeout' => 4, 'redirection' => 0, 'limit_response_size' => 32768,
                    'headers' => array('Content-Type' => 'application/json', 'Accept' => 'application/json'),
                    'body' => wp_json_encode(array('method' => 'account_info', 'params' => array(array(
                        'account' => self::WALLET, 'ledger_index' => 'validated',
                    )))),
                ));
                if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) { continue; }
                $body = json_decode(wp_remote_retrieve_body($response), true);
                $r = isset($body['result']) && is_array($body['result']) ? $body['result'] : array();
                $a = isset($r['account_data']) && is_array($r['account_data']) ? $r['account_data'] : array();
                if (!empty($r['error']) || !isset($r['validated'], $r['ledger_index'], $a['Account'], $a['Balance']) ||
                    $r['validated'] !== true || !is_int($r['ledger_index']) || $r['ledger_index'] <= 0 ||
                    $a['Account'] !== self::WALLET || !is_string($a['Balance']) ||
                    !preg_match('/^(0|[1-9][0-9]{0,17})$/D', $a['Balance']) ||
                    (strlen($a['Balance']) === 18 && strcmp($a['Balance'], '100000000000000000') > 0) ||
                    ($saved && $r['ledger_index'] < $saved['ledgerIndex'])) { continue; }
                $saved = array('wallet' => self::WALLET, 'network' => 'mainnet',
                    'balanceDrops' => $a['Balance'], 'ledgerIndex' => $r['ledger_index'],
                    'checkedAt' => time(), 'validated' => true);
                set_transient(self::CACHE, $saved, 86400);
                $fresh = true;
                break;
            }
        }
        $data = $saved ?: array('wallet' => self::WALLET, 'network' => 'mainnet',
            'balanceDrops' => null, 'ledgerIndex' => null, 'checkedAt' => null, 'validated' => false);
        $data['status'] = $fresh ? 'current' : ($saved ? 'stale' : 'unavailable');
        $data['refreshAfter'] = self::INTERVAL;
        $total = class_exists(DonationLedger::class) ? DonationLedger::snapshot() : null;
        if ($total) {
            $data = array_merge($data, $total);
            $data['donationsStatus'] = $total['donationsCheckedAt'] > 0 && $now - $total['donationsCheckedAt'] < 900 ? 'current' : 'stale';
        }
        $result = new \WP_REST_Response($data, ($saved || $total) ? 200 : 503);
        $result->header('Cache-Control', 'public, max-age=15, s-maxage=15');
        $result->header('X-Content-Type-Options', 'nosniff');
        return $result;
    }
}

add_action('rest_api_init', array(Donations::class, 'register'));
add_action('wp_enqueue_scripts', array(Donations::class, 'enqueue'), 100);
add_filter('brizy_content', array(Donations::class, 'replace_meter'), 9997);
add_filter('the_content', array(Donations::class, 'replace_meter'), 9997);
