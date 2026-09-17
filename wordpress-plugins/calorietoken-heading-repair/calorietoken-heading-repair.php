<?php
/**
 * Plugin Name: CalorieToken Heading and Language Repair
 * Description: Reversible, hash-gated heading repair plus compact account presentation, CalorieApp focus, age-appropriate routing and a private aggregate source/product-grade summary. Does not replace or edit the installed Site Style plugin.
 * Version: 1.6.11
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */
namespace CalorieToken\HeadingRepair;
if (!defined('ABSPATH')) { exit; }
const VERSION = '1.6.11';
function plugin_source_matches($plugin, $name, $hashes) {
    $path = WP_PLUGIN_DIR . '/' . $plugin . '/' . $name;
    if (!is_readable($path) || !is_file($path)) { return false; }
    $actual = hash_file('sha256', $path);
    return is_string($actual) && in_array($actual, $hashes, true);
}
function source_matches($name, $hashes) {
    return plugin_source_matches('calorietoken-site-style', $name, $hashes);
}
function bridge_session_matches() {
    return defined('CALORIEAPP_IDENTITY_BRIDGE_VERSION')
        && CALORIEAPP_IDENTITY_BRIDGE_VERSION === '0.3.29'
        && plugin_source_matches('calorieapp-identity-bridge', 'assets/calorieapp-site-session.js', array(
            '9d1bfe78004f23c3ca825d81fe5dc8d0898b7a497f980692d322a5881acc63cf',
            // Same reviewed JavaScript if the packaging layer removed only
            // the final empty newline.
            '4e476bed175cf066db377b3b7ff1489d7aad95f3c3abf3fa77ca4a65bc0cacf4'
        ));
}
function compatibility() {
    $main = source_matches('calorietoken-site-style.php', array(
        '942d26dab4f79fb25c53aeb3ce53d800f79fb9b347f5b68233b95b323c86d06e',
        '705561b2d3b43f664da4365bfce001873bfeb430772532c3ba2f5d865663bd2e'
    ));
    return array(
        'presentation' => $main && source_matches('assets/presentation.js', array(
            '7b69010d2435144cfa0169f3e45a3c961901756792cc366bf50661e583d4cf63',
            // Exact live 1.4.46 bytes after WordPress removed only the final
            // empty newline; the executable JavaScript content is unchanged.
            '96ffa90b05ada8488c800d0970159c59847fe6fcadec85141709f306c766490c',
            '1039c8d43c2ce3c6d85355587a611c3e1fa0012e42dc56ad7c6c88e2ece6462f'
        )),
        'help' => $main && source_matches('assets/help.js', array(
            'c9671113ca157cc52b81b02fe23f79c287670f582a70bff2261f26bd8ae2b527',
            '4f854c6254612c0b6569ed41ef989b90f09af69b3849a43b7977294fe230cac4'
        )),
        'app-integration' => $main && source_matches('assets/app-integration.js', array('5ffc9f400e98573ade9aa49e516fa24a678373e9a1ce13b3c3aea3352875dd50')),
        'blog-timeline' => $main && source_matches('assets/blog-timeline.js', array('7a3c971f02551f27d81afe0fedae7dd58bb29f009648a4e7fca1c42b57e47fae')),
        'discovery' => $main && source_matches('assets/discovery.js', array('55791503ecac567b7b046568c6c8a1a67ba2fa27371cca889e1aa018bc4cfe29')),
        'menu-pages' => $main && source_matches('assets/menu-pages.js', array('ed1f0e17e4c89d1f469612026be4d9e9a3ecb293f41afffa580278fc4f76a0f7')),
        'ready-languages' => $main && source_matches('assets/ready-languages.js', array('47cb40c56c2eef2e819a582e60e72bdbb832e9362a70e458429d44004eafdd21')),
        'testnet' => $main && source_matches('assets/testnet.js', array('8c353fc0dfb66b5cc1b7d71f83681dd15e859f4f0e3c185b4190ce195aee4b9b')),
        'tokenomics' => $main && source_matches('assets/tokenomics.js', array('cb36d6d0247b53e20536b99cbb6ec34deda5d8aff4363673f7cb85a86556f48d'))
    );
}
function asset_url($file) { return add_query_arg('ver', VERSION, plugins_url('assets/' . $file, __FILE__)); }
function enqueue() {
    if (is_admin() || is_feed() || is_embed() || (defined('REST_REQUEST') && REST_REQUEST)) { return; }
    $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    if (!in_array($host, array('calorietoken.net', 'www.calorietoken.net'), true)) { return; }
    $ok = compatibility();
    $map = array();
    if ($ok['presentation'] && wp_script_is('calorietoken-presentation', 'enqueued') && !wp_script_is('calorietoken-presentation', 'done')) {
        $map['calorietoken-presentation'] = array('source' => 'presentation.js', 'replacement' => 'presentation.js');
        wp_enqueue_style('calorietoken-heading-repair', asset_url('heading-repair.css'), array('calorietoken-presentation'), VERSION);
    }
    if ($ok['help'] && wp_script_is('calorietoken-help', 'enqueued') && !wp_script_is('calorietoken-help', 'done')) {
        $raw = file_get_contents(__DIR__ . '/assets/help-link-labels.json');
        $labels = is_string($raw) ? json_decode($raw, true) : null;
        $topic_raw = file_get_contents(__DIR__ . '/assets/help-topic-additions.json');
        $topics = is_string($topic_raw) ? json_decode($topic_raw, true) : null;
        $bootstrap = file_get_contents(__DIR__ . '/assets/help-label-bootstrap.js');
        if (is_array($labels) && is_array($topics) && is_string($bootstrap)) {
            $map['calorietoken-help'] = array('source' => 'help.js', 'replacement' => 'help.js');
            wp_add_inline_script('calorietoken-help',
                'window.CalorieTokenHeadingRepairLabels=' . wp_json_encode($labels, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';' .
                'window.CalorieTokenHeadingRepairTopics=' . wp_json_encode($topics, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';' .
                'window.CalorieTokenHeadingRepairAvatar=' . wp_json_encode(asset_url('caloriehelp-mascot-v2.png'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';' .
                $bootstrap, 'before');
        }
    }
    if ($ok['presentation'] && $ok['help']) {
        wp_enqueue_script('calorietoken-language-bootstrap', asset_url('language-bootstrap.js'), array(), VERSION, false);
        wp_enqueue_style('calorietoken-app-focus', asset_url('app-focus.css'), array(), VERSION);
        wp_enqueue_script('calorietoken-age-experience', asset_url('age-experience.js'), array(), VERSION, true);
        wp_enqueue_script('calorietoken-app-focus', asset_url('app-focus.js'), array('calorietoken-age-experience'), VERSION, true);
        wp_enqueue_script('calorietoken-nutrition-summary', asset_url('nutrition-summary.js'), array('calorietoken-app-focus'), VERSION, true);
        // Content-only presentation after the compatible site's own controllers.
        // Historical artwork, header/title/footer and embedded apps stay native.
        wp_enqueue_style('calorietoken-content-style', asset_url('content-style.css'), array('calorietoken-presentation'), VERSION);
        wp_enqueue_script('calorietoken-content-style', asset_url('content-style.js'), array('calorietoken-presentation'), VERSION, true);
    }
    $site_overrides = array(
        'app-integration' => array('handle' => 'calorietoken-app-integration', 'source' => 'app-integration.js', 'replacement' => 'site-app-integration.js'),
        'blog-timeline' => array('handle' => 'calorietoken-blog-timeline', 'source' => 'blog-timeline.js', 'replacement' => 'site-blog-timeline.js'),
        'discovery' => array('handle' => 'calorietoken-discovery', 'source' => 'discovery.js', 'replacement' => 'site-discovery.js'),
        'menu-pages' => array('handle' => 'calorietoken-menu-pages', 'source' => 'menu-pages.js', 'replacement' => 'site-menu-pages.js'),
        'ready-languages' => array('handle' => 'calorietoken-ready-languages', 'source' => 'ready-languages.js', 'replacement' => 'site-ready-languages.js'),
        'testnet' => array('handle' => 'calorietoken-testnet', 'source' => 'testnet.js', 'replacement' => 'site-testnet.js'),
        'tokenomics' => array('handle' => 'calorietoken-tokenomics', 'source' => 'tokenomics.js', 'replacement' => 'site-tokenomics.js')
    );
    foreach ($site_overrides as $key => $entry) {
        if ($ok[$key] && wp_script_is($entry['handle'], 'enqueued') && !wp_script_is($entry['handle'], 'done')) {
            $map[$entry['handle']] = array('source' => $entry['source'], 'replacement' => $entry['replacement']);
        }
    }
    if (bridge_session_matches()) {
        // Identity Bridge 0.3.29 queues this controller from wp_footer after
        // wp_enqueue_scripts. Register the exact-handle URL substitution now;
        // it is applied only if that known script is eventually printed.
        $map['calorieapp-identity-bridge-site-session'] = array(
            'plugin' => 'calorieapp-identity-bridge',
            'source' => 'calorieapp-site-session.js',
            'replacement' => 'site-session-repair.js'
        );
    }
    if (!$map) { return; }
    // Keep the original handle, dependencies, data, and inline scripts. Only the
    // URL of the exact known asset is substituted. The installed files are untouched.
    add_filter('script_loader_src', static function ($src, $handle) use ($map) {
        if (!isset($map[$handle])) { return $src; }
        $source_host = strtolower((string) wp_parse_url($src, PHP_URL_HOST));
        if (!in_array($source_host, array('calorietoken.net', 'www.calorietoken.net'), true)) { return $src; }
        $path = (string) wp_parse_url($src, PHP_URL_PATH);
        $plugin = isset($map[$handle]['plugin']) ? $map[$handle]['plugin'] : 'calorietoken-site-style';
        $ending = '/' . $plugin . '/assets/' . $map[$handle]['source'];
        if (substr($path, -strlen($ending)) !== $ending) { return $src; }
        return asset_url($map[$handle]['replacement']);
    }, 1000, 2);
}
function admin_notice() {
    if (!current_user_can('activate_plugins')) { return; }
    $ok = compatibility();
    $bridge_expected = defined('CALORIEAPP_IDENTITY_BRIDGE_VERSION')
        && CALORIEAPP_IDENTITY_BRIDGE_VERSION === '0.3.29';
    $bridge_ok = !$bridge_expected || bridge_session_matches();
    if (!in_array(false, $ok, true) && $bridge_ok) { return; }
    $message = 'CalorieToken repair: one or more installed sources differ from the saved, tested Site Style 1.4.46 files or Site Style is missing. ';
    $message .= 'Only exact matching assets were enabled; non-matching overrides stayed off. ';
    if (!$bridge_ok) {
        $message .= 'The Identity Bridge 0.3.29 session controller also differs, so the mobile login/logout repair stayed off. ';
    }
    $message .= 'No installed files were overwritten. Reconcile the current source before changing the compatibility checks.';
    echo '<div class="notice notice-warning"><p>' . esc_html($message) . '</p></div>';
}
function content_layer_order() {
    // wp_enqueue_scripts has completed; declare only our layer before WP prints
    // the legacy styles. Important layer precedence otherwise reverses source
    // order, allowing the existing serif/oversized card rules to win again.
    if (wp_style_is('calorietoken-content-style', 'enqueued')) {
        echo '<style id="calorietoken-content-layer">@layer calorietoken-content;</style>';
    }
}
add_action('wp_enqueue_scripts', __NAMESPACE__ . '\\enqueue', 1000);
add_action('wp_head', __NAMESPACE__ . '\\content_layer_order', 2);
add_action('admin_notices', __NAMESPACE__ . '\\admin_notice');
