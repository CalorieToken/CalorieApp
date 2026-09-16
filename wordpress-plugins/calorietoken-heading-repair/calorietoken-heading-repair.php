<?php
/**
 * Plugin Name: CalorieToken Heading and Language Repair
 * Description: Reversible, hash-gated heading repair plus compact account presentation, CalorieApp focus, age-appropriate routing and a private aggregate source/product-grade summary. Does not replace or edit the installed Site Style plugin.
 * Version: 1.5.5
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */
namespace CalorieToken\HeadingRepair;
if (!defined('ABSPATH')) { exit; }
const VERSION = '1.5.5';
function source_matches($name, $hashes) {
    $path = WP_PLUGIN_DIR . '/calorietoken-site-style/' . $name;
    if (!is_readable($path) || !is_file($path)) { return false; }
    $actual = hash_file('sha256', $path);
    return is_string($actual) && in_array($actual, $hashes, true);
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
        ))
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
        $map['calorietoken-presentation'] = 'presentation.js';
        wp_enqueue_style('calorietoken-heading-repair', asset_url('heading-repair.css'), array('calorietoken-presentation'), VERSION);
    }
    if ($ok['help'] && wp_script_is('calorietoken-help', 'enqueued') && !wp_script_is('calorietoken-help', 'done')) {
        $raw = file_get_contents(__DIR__ . '/assets/help-link-labels.json');
        $labels = is_string($raw) ? json_decode($raw, true) : null;
        $topic_raw = file_get_contents(__DIR__ . '/assets/help-topic-additions.json');
        $topics = is_string($topic_raw) ? json_decode($topic_raw, true) : null;
        $bootstrap = file_get_contents(__DIR__ . '/assets/help-label-bootstrap.js');
        if (is_array($labels) && is_array($topics) && is_string($bootstrap)) {
            $map['calorietoken-help'] = 'help.js';
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
    }
    if (!$map) { return; }
    // Keep the original handle, dependencies, data, and inline scripts. Only the
    // URL of the exact known asset is substituted. The installed files are untouched.
    add_filter('script_loader_src', static function ($src, $handle) use ($map) {
        if (!isset($map[$handle])) { return $src; }
        $source_host = strtolower((string) wp_parse_url($src, PHP_URL_HOST));
        if (!in_array($source_host, array('calorietoken.net', 'www.calorietoken.net'), true)) { return $src; }
        $path = (string) wp_parse_url($src, PHP_URL_PATH);
        $ending = '/calorietoken-site-style/assets/' . $map[$handle];
        if (substr($path, -strlen($ending)) !== $ending) { return $src; }
        return asset_url($map[$handle]);
    }, 1000, 2);
}
function admin_notice() {
    if (!current_user_can('activate_plugins')) { return; }
    $ok = compatibility();
    if ($ok['presentation'] && $ok['help']) { return; }
    $message = 'CalorieToken repair: the installed source differs from the saved, tested files or Site Style is missing. ';
    $message .= !$ok['presentation'] ? 'Heading repair was not enabled. ' : 'Heading repair matches the saved source. ';
    $message .= !$ok['help'] ? 'Help-link repair was not enabled. ' : '';
    $message .= 'No installed files were overwritten. Reconcile the current source before changing the compatibility checks.';
    echo '<div class="notice notice-warning"><p>' . esc_html($message) . '</p></div>';
}
add_action('wp_enqueue_scripts', __NAMESPACE__ . '\\enqueue', 1000);
add_action('admin_notices', __NAMESPACE__ . '\\admin_notice');
