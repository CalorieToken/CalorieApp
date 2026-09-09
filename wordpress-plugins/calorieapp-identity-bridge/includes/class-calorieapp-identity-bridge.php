<?php

namespace CalorieApp\IdentityBridge;

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-calorieapp-identity-bridge-storage.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-locale-registry.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-rest.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-browser-authorize.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-integrated-login.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-admin.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-legal-footer-compatibility.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-market-widget.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-page-ending.php';
require_once __DIR__ . '/class-calorieapp-identity-bridge-display-language.php';

class Plugin {
    public const OPTION_KEY = 'calorieapp_identity_bridge_options';

    private static ?Plugin $instance = null;

    private Storage $storage;

    private RestApi $rest_api;

    private BrowserAuthorize $browser_authorize;

    private IntegratedLogin $integrated_login;

    private Admin $admin;

    private LegalFooterCompatibility $legal_footer_compatibility;

    private MarketWidget $market_widget;

    private PageEnding $page_ending;
    private DisplayLanguage $display_language;

    public static function instance(): Plugin {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct() {
        $this->storage = new Storage();
        $this->rest_api = new RestApi($this->storage);
        $this->browser_authorize = new BrowserAuthorize($this->rest_api);
        $this->integrated_login = new IntegratedLogin($this->rest_api);
        $this->admin = new Admin();
        $this->legal_footer_compatibility = new LegalFooterCompatibility();
        $this->market_widget = new MarketWidget();
        $this->page_ending = new PageEnding();
        $this->display_language = new DisplayLanguage();

        register_activation_hook(CALORIEAPP_IDENTITY_BRIDGE_FILE, [$this, 'activate']);

        add_action('plugins_loaded', [$this, 'init']);
    }

    public function init(): void {
        $this->storage->register_hooks();
        $this->rest_api->register_hooks();
        $this->browser_authorize->register_hooks();
        $this->integrated_login->register_hooks();
        $this->admin->register_hooks();
        $this->legal_footer_compatibility->register_hooks();
        $this->market_widget->register_hooks();
        $this->page_ending->register_hooks();
        $this->display_language->register_hooks();
        add_filter('woocommerce_add_to_cart_redirect', [self::class, 'donation_return_url'], 20, 2);
    }

    /** Finish a successful donation form submission on a reloadable GET page. */
    public static function donation_return_url($url, $product = null) {
        // WooCommerce invokes this filter only after its normal validation and
        // successful add-to-cart. Keep explicit redirects and its cart setting.
        if ($url
            || is_admin()
            || wp_doing_ajax()
            || (defined('REST_REQUEST') && REST_REQUEST)
            || strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST'
            || !isset($_POST['wcj_open_price'])
            || !($product instanceof \WC_Product)
            || $product->get_slug() !== 'donation'
            || get_option('woocommerce_cart_redirect_after_add') === 'yes'
        ) {
            return $url;
        }

        // Return to the same product and its existing donation summary without
        // keeping a POST response in browser history. Do not resubmit, reprice,
        // create an order, or change payment/cancellation state here.
        return get_permalink($product->get_id()) ?: $url;
    }

    public function activate(): void {
        $this->storage->create_table();
        $this->seed_default_options();
    }

    private function seed_default_options(): void {
        $defaults = self::default_options();
        $existing = get_option(self::OPTION_KEY);

        if (!is_array($existing)) {
            add_option(self::OPTION_KEY, $defaults, '', false);
            return;
        }

        update_option(self::OPTION_KEY, wp_parse_args($existing, $defaults), false);
    }

    public static function default_options(): array {
        return [
            'callback_allowlist' => '',
            'default_callback_url' => '',
            'calorieapp_backend_url' => '',
            'bridge_secret' => '',
            'backend_client_id' => 'calorieapp-backend',
            'code_ttl_seconds' => 60,
        ];
    }

    public static function get_options(): array {
        $saved = get_option(self::OPTION_KEY, []);

        if (!is_array($saved)) {
            $saved = [];
        }

        return wp_parse_args($saved, self::default_options());
    }
}
