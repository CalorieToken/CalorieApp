<?php
/** Exercise the callback reached after WooCommerce accepts a donation. */
define('ABSPATH', __DIR__);
$state = [];
function is_admin(): bool { return !empty($GLOBALS['state']['admin']); }
function wp_doing_ajax(): bool { return !empty($GLOBALS['state']['ajax']); }
function get_option($name) { return $GLOBALS['state']['cart_redirect'] ?? 'no'; }
function get_permalink($id): string { return 'https://calorietoken.net/index.php/product/donation/'; }
class WC_Product {
    private string $slug;
    public function __construct(string $slug = 'donation') { $this->slug = $slug; }
    public function get_slug(): string { return $this->slug; }
    public function get_id(): int { return 1761; }
}
require __DIR__ . '/../../wordpress-plugins/calorieapp-identity-bridge/includes/class-calorieapp-identity-bridge.php';
use CalorieApp\IdentityBridge\Plugin;

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = ['wcj_open_price' => '0.01', 'quantity' => '1', 'add-to-cart' => '1761'];
$before = $_POST;
$donation = new WC_Product();
check(Plugin::donation_return_url(false, $donation) === get_permalink(1761), 'Use a normal product URL after a successful donation POST.');
check($_POST === $before, 'Preserve the amount, quantity and original submitted fields.');
$existing = 'https://calorietoken.net/index.php/cart/';
check(Plugin::donation_return_url($existing, $donation) === $existing, 'Respect an existing redirect.');
foreach ([['admin' => true], ['ajax' => true], ['cart_redirect' => 'yes']] as $flags) {
    $state = $flags;
    check(Plugin::donation_return_url(false, $donation) === false, 'Leave admin, AJAX and configured WooCommerce cart redirects alone.');
}
$state = [];
foreach ([null, new stdClass(), new WC_Product('merchandise')] as $product) {
    check(Plugin::donation_return_url(false, $product) === false, 'Only the donation product qualifies.');
}
$_SERVER['REQUEST_METHOD'] = 'GET';
check(Plugin::donation_return_url(false, $donation) === false, 'Do not redirect ordinary product views.');
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = [];
check(Plugin::donation_return_url(false, $donation) === false, 'Leave unrelated POST handlers alone.');
echo "Donation return URL and preserved WooCommerce behavior passed.\n";
