<?php
namespace CalorieToken\SiteStyle;
if (!defined('ABSPATH')) { exit; }

/** Narrow, recoverable publication requested for this release. No Brizy writes. */
final class PublicPages {
    const KEY = 'ctstyle_public_pages_142';
    public static function is_document() {
        if (is_page(array(531,586,7860,7876))) { return true; }
        $id = (int) get_option('ctstyle_public_hub_id', 0);
        return $id > 0 && is_page($id) && get_post_meta($id, '_ctstyle_public_hub', true) === '1';
    }
    public static function template($path) {
        if (Plugin::enabled() && self::is_document() && !is_preview()) { return __DIR__ . '/public-template.php'; }
        return $path;
    }
    public static function legal_update($id, $content) {
        if (!in_array($id, array(531,586), true) || strpos($content, 'ICTHendrikse') === false ||
            strpos($content, '73774693') === false || strpos($content, '25 August 2026') === false ||
            strpos($content, 'CalorieApp V1') === false || strpos($content, 'ctstyle-public-update') !== false) { return null; }
        $extra = @file_get_contents(__DIR__ . '/content/' . ($id === 531 ? 'privacy' : 'terms') . '.html');
        if (!is_string($extra) || $extra === '') { return null; }
        // Exact old product-version wording, leaving rights and provider clauses intact.
        $content = str_replace('CalorieApp V1', 'CalorieApp V2', $content);
        $content = str_replace('25 August 2026', '10 September 2026', $content);
        return $content . "\n" . $extra;
    }
    public static function migrate() {
        if (!is_admin() || !current_user_can('manage_options') || !current_user_can('publish_pages') ||
            get_option(self::KEY) === 'complete' ||
            !in_array(wp_parse_url(home_url('/'), PHP_URL_HOST), array('calorietoken.net','www.calorietoken.net'), true)) { return; }
        // Recover an abandoned lock without deleting a newer concurrent owner's lock.
        $lock_key = self::KEY . '_lock';
        $locked_at = get_option($lock_key);
        if (is_numeric($locked_at) && (int) $locked_at > 0 && (int) $locked_at < time() - 900) {
            global $wpdb;
            $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s", $lock_key, (string) $locked_at));
            wp_cache_delete($lock_key, 'options');
            wp_cache_delete('notoptions', 'options');
        }
        // The unique option insert still decides which dashboard request owns migration.
        if (!add_option(self::KEY . '_lock', time(), '', false)) { return; }
        $errors = array();
        try {
            foreach (array(531,586) as $id) {
                $post = get_post($id);
                if (!$post || $post->post_type !== 'page' || $post->post_status !== 'publish') { $errors[] = 'Page ' . $id . ' was not updated.'; continue; }
                if (strpos($post->post_content, 'ctstyle-public-update') !== false) { continue; }
                $updated = self::legal_update($id, $post->post_content);
                if ($updated === null) { $errors[] = 'Page ' . $id . ' has different source text; it was preserved.'; continue; }
                $backup_key = self::KEY . '_before_' . $id;
                if (!add_option($backup_key, array('content'=>$post->post_content,'sha256'=>hash('sha256',$post->post_content),'modified'=>$post->post_modified_gmt), '', false)) {
                    $backup = get_option($backup_key);
                    if (!is_array($backup) || !isset($backup['sha256']) || $backup['sha256'] !== hash('sha256',$post->post_content)) { $errors[] = 'Page ' . $id . ' changed after its backup; it was preserved.'; continue; }
                }
                $result = wp_update_post(wp_slash(array('ID'=>$id,'post_content'=>$updated)), true);
                if (is_wp_error($result)) { $errors[] = 'Page ' . $id . ' could not be saved.'; }
            }
            $hub = get_page_by_path('community-voting-hub-info', OBJECT, 'page');
            // Never publish the historical draft with its obsolete voting shortcodes.
            if ($hub && $hub->post_status === 'publish' && get_post_meta($hub->ID, '_ctstyle_public_hub', true) !== '1') {
                $errors[] = 'An existing public Community Voting Hub was preserved.';
            } else {
                $managed_id = (int) get_option('ctstyle_public_hub_id', 0);
                $managed = $managed_id ? get_post($managed_id) : null;
                if ($managed && get_post_meta($managed_id, '_ctstyle_public_hub', true) === '1') {
                    // An operator edit or unpublication is authoritative; never undo it.
                } elseif (!$managed_id) {
                    $html = @file_get_contents(__DIR__ . '/content/community.html');
                    if (!is_string($html) || trim($html) === '') {
                        $errors[] = 'The informational Community Voting Hub content is unavailable; no page was created.';
                    } else {
                    $result = wp_insert_post(wp_slash(array('post_type'=>'page','post_status'=>'publish',
                        'post_title'=>'Community Voting Hub','post_name'=>'community-voting-hub-info',
                        'post_content'=>$html,'comment_status'=>'closed','ping_status'=>'closed',
                        'meta_input'=>array('_ctstyle_public_hub'=>'1'))), true);
                    if (is_wp_error($result) || !$result) { $errors[] = 'The informational Community Voting Hub could not be created.'; }
                    else { update_option('ctstyle_public_hub_id', (int) $result, false); }
                    }
                } else { $errors[] = 'The previously created hub was removed; it was not recreated.'; }
            }
            update_option(self::KEY . '_notes', $errors, false);
            // Failed items are reported, not retried automatically on every dashboard request.
            update_option(self::KEY, 'complete', false);
        } finally { delete_option(self::KEY . '_lock'); }
    }
    public static function notice() {
        if (!current_user_can('manage_options')) { return; }
        $notes = get_option(self::KEY . '_notes', array());
        if (!$notes || !is_array($notes)) { return; }
        echo '<div class="notice notice-warning"><p><strong>CalorieToken Site Style:</strong> ' . esc_html(implode(' ', $notes)) . '</p></div>';
    }
}
add_action('admin_init', array(PublicPages::class, 'migrate'));
add_action('admin_notices', array(PublicPages::class, 'notice'));
add_filter('template_include', array(PublicPages::class, 'template'), 99);
