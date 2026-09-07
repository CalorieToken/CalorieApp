<?php
/** Only normal donation product/cart HTML may use the POST footer correction. */
define('ABSPATH', __DIR__);
$state = [];
function is_admin(): bool { return !empty($GLOBALS['state']['admin']); }
function is_feed(): bool { return !empty($GLOBALS['state']['feed']); }
function is_embed(): bool { return !empty($GLOBALS['state']['embed']); }
function is_trackback(): bool { return false; }
function wp_doing_ajax(): bool { return !empty($GLOBALS['state']['ajax']); }
function is_cart(): bool { return !empty($GLOBALS['state']['cart']); }
function is_product(): bool { return !empty($GLOBALS['state']['product']); }
require __DIR__ . '/../../wordpress-plugins/calorieapp-identity-bridge/includes/class-calorieapp-identity-bridge-legal-footer-compatibility.php';
use CalorieApp\IdentityBridge\LegalFooterCompatibility;

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function response(string $method, array $flags, string $body): string {
    $GLOBALS['state'] = $flags;
    $_SERVER['REQUEST_METHOD'] = $method;
    ob_start();
    $level = ob_get_level();
    (new LegalFooterCompatibility())->start_output_buffer();
    echo $body;
    if (ob_get_level() > $level) ob_end_flush();
    return (string) ob_get_clean();
}
$body = '<!doctype html><html><body><form><input name="amount" value="0.01"></form>'
    . '<footer>Chamber of Commerce KVK: 84216352 / © 2023 Calorie Token</footer></body></html>';
foreach (['cart', 'product'] as $page) {
    $result = response('POST', [$page => true], $body);
    check(str_contains($result, 'Operator: ICTHendrikse · KVK 73774693'), 'Correct the footer after a donation form POST.');
    check(str_contains($result, '<input name="amount" value="0.01">'), 'Preserve all form data.');
}
foreach ([[], ['checkout' => true], ['cart' => true, 'ajax' => true], ['product' => true, 'admin' => true]] as $flags) {
    check(response('POST', $flags, $body) === $body, 'Do not rewrite checkout, AJAX, admin or other POST handlers.');
}
foreach (['GET', 'HEAD'] as $method) {
    check(!str_contains(response($method, [], $body), '84216352'), 'Retain existing GET/HEAD footer correction.');
}
foreach (['', '{"detail":"© 2023 Calorie Token"}', '<div>© 2023 Calorie Token</div>'] as $payload) {
    check(response('POST', ['product' => true], $payload) === $payload, 'Leave redirect bodies, JSON and fragments untouched.');
}
echo "Donation POST footer and preserved response boundaries passed.\n";
