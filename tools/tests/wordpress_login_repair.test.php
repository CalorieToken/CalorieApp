<?php
// Real filesystem checks against the exact extracted, distributable package.
define('ABSPATH', __DIR__ . '/');
define('CALORIEAPP_IDENTITY_BRIDGE_VERSION', '0.3.29');
define('WP_PLUGIN_DIR', sys_get_temp_dir() . '/calorieapp-repair-test-' . bin2hex(random_bytes(8)));

class TestRestApi {}
class_alias(TestRestApi::class, 'CalorieApp\\IdentityBridge\\RestApi');
$allowed = true;
$status = '';
function current_user_can($capability) { return $GLOBALS['allowed']; }
function wp_die($message) { throw new RuntimeException($message); }
function esc_html($value) { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
function update_option($key, $value, $autoload) { $GLOBALS['status'] = $value; }
function register_activation_hook($file, $callback) {}
function register_deactivation_hook($file, $callback) {}
function add_action($name, $callback) {}
function check($condition, $message) { if (!$condition) { throw new RuntimeException($message); } }
function refused($callback) {
    try { $callback(); } catch (RuntimeException $error) { return; }
    throw new RuntimeException('Unexpected successful activation');
}

$package = $argv[1] ?? '';
check(is_file($package . '/calorieapp-login-repair.php'), 'Pass the extracted package directory');
require $package . '/calorieapp-login-repair.php';
use CalorieApp\LoginRepair\Repair;

$directory = WP_PLUGIN_DIR . '/calorieapp-identity-bridge/includes';
mkdir($directory, 0755, true);
$target = $directory . '/class-calorieapp-identity-bridge-rest.php';
$sentinel = dirname($directory) . '/calorieapp-identity-bridge.php';
$before = file_get_contents($package . '/payload/before.php');
$after = file_get_contents($package . '/payload/after.php');
check(hash('sha256', $before) === Repair::BEFORE_SHA256, 'Original payload hash');
check(hash('sha256', $after) === Repair::AFTER_SHA256, 'New payload hash');
file_put_contents($target, $before);
file_put_contents($sentinel, 'Existing 0.3.29 files must be preserved');
chmod($target, 0644);

$allowed = false;
refused([Repair::class, 'activate']);
check(file_get_contents($target) === $before, 'No permission: unchanged');
$allowed = true;
Repair::activate();
check(file_get_contents($target) === $after && $status === 'applied', 'Activation applies exact payload');
check((fileperms($target) & 0777) === 0644, 'File permissions preserved');
check(file_get_contents($sentinel) === 'Existing 0.3.29 files must be preserved', 'Other files preserved');
Repair::activate();
check(file_get_contents($target) === $after, 'Activation is idempotent');
Repair::deactivate();
check(file_get_contents($target) === $before && $status === 'restored', 'Rollback restores exact original');
Repair::deactivate();
check(file_get_contents($target) === $before, 'Rollback is idempotent');

file_put_contents($target, $before . "\n// Previously unknown live enhancement\n");
$unknown = file_get_contents($target);
refused([Repair::class, 'activate']);
check(file_get_contents($target) === $unknown, 'Unknown live source preserved');
Repair::deactivate();
check(file_get_contents($target) === $unknown && $status === 'restore_skipped', 'Rollback preserves a newer update');

file_put_contents($target, $before);
$payload = $package . '/payload/after.php';
file_put_contents($payload, $after . "\n// corruption\n");
refused([Repair::class, 'activate']);
check(file_get_contents($target) === $before, 'Corrupt payload does not modify live file');
file_put_contents($payload, $after);
unlink($target);
symlink($sentinel, $target);
refused([Repair::class, 'activate']);
check(file_get_contents($sentinel) === 'Existing 0.3.29 files must be preserved', 'Symlink rejected');
unlink($target);
check(count(glob($directory . '/.calorieapp-repair-*')) === 0, 'No temporary files remain');
unlink($sentinel);
rmdir($directory);
rmdir(dirname($directory));
rmdir(WP_PLUGIN_DIR);
echo "WordPress login repair installation and rollback tests passed.\n";
