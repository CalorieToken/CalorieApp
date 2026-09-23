<?php
/**
 * Plugin Name: CalorieToken Public Page Consistency
 * Description: Narrow layout/language repair for the public Collaborate and Contribute Food Data pages.
 * Version: 0.1.0
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: ICTHendrikse
 * License: GPL-2.0-or-later
 */

namespace CalorieToken\PublicPageConsistency;

if (!defined('ABSPATH')) { exit; }

final class Plugin {
    const VERSION = '0.1.0';

    public static function enqueue() {
        if (is_admin() || is_feed() || is_embed() ||
            (defined('REST_REQUEST') && REST_REQUEST) ||
            (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
            (function_exists('is_customize_preview') && is_customize_preview()) ||
            !is_page(array(8144, 8263))) {
            return;
        }
        foreach (array('preview','customize_changeset_uuid','brizy-edit','brizy-edit-iframe','brz-edit','brz-edit-iframe') as $key) {
            if (isset($_GET[$key])) { return; }
        }
        $base = plugin_dir_url(__FILE__);
        wp_enqueue_style(
            'calorietoken-public-page-consistency',
            $base . 'assets/public-page-consistency.css',
            array(),
            self::VERSION
        );
        wp_enqueue_script(
            'calorietoken-public-page-consistency',
            $base . 'assets/public-page-consistency.js',
            array(),
            self::VERSION,
            true
        );
        wp_localize_script('calorietoken-public-page-consistency', 'CalorieTokenPublicPageConsistency', array(
            'page' => get_queried_object_id(),
        ));
    }
}
add_action('wp_enqueue_scripts', array(Plugin::class, 'enqueue'), 120);
