<?php
namespace CalorieToken\SiteStyle;
if (!defined('ABSPATH')) { exit; }

/** Read-only review aid; never edits posts, options, Brizy data or account data. */
final class Review {
    const LIMIT = 500;
    public static function register() {
        add_management_page('CalorieToken review', 'CalorieToken review', 'manage_options', 'calorietoken-review', array(self::class, 'page'));
    }
    public static function snapshot() {
        if (!current_user_can('manage_options')) { return null; }
        $posts = get_posts(array('post_type'=>array('page','post'),
            'post_status'=>array('publish','draft','pending','private','future'),
            'numberposts'=>self::LIMIT + 1, 'orderby'=>'ID', 'order'=>'ASC'));
        $truncated = count($posts) > self::LIMIT;
        $posts = array_slice($posts, 0, self::LIMIT);
        $rows = array(); $counts = array();
        foreach ($posts as $post) {
            $flags = array(); $source = (string) $post->post_content;
            if (preg_match('/CalorieApp\s+V1\b/i', $source)) { $flags[] = 'Legacy CalorieApp V1 wording'; }
            if (stripos($source, '/integrated-exchange') !== false) { $flags[] = 'Historical Integrated Exchange reference'; }
            if (stripos($source, 'sologenic.org') !== false) { $flags[] = 'Sologenic reference to review'; }
            if (stripos($source, 'livecoinwatch.com') !== false) { $flags[] = 'LiveCoinWatch reference to review'; }
            $status = (string) $post->post_status;
            $counts[$status] = isset($counts[$status]) ? $counts[$status] + 1 : 1;
            $rows[] = array('id'=>(int) $post->ID, 'type'=>(string) $post->post_type,
                'status'=>$status, 'title'=>wp_strip_all_tags($post->post_title),
                'url'=>$status === 'publish' ? get_permalink($post->ID) : null,
                'source_flags'=>$flags);
        }
        return array('schema'=>'calorietoken.site-review.v1', 'plugin_version'=>Plugin::VERSION,
            'generated_at_utc'=>gmdate('c'), 'limit'=>self::LIMIT, 'truncated'=>$truncated,
            'counts'=>$counts, 'pages'=>$rows,
            'coverage'=>'Page/post inventory and stored WordPress content only. Brizy metadata, rendered layout, images, external links and legal accuracy require separate review. Flags identify review candidates, not confirmed defects.');
    }
    public static function export() {
        if (!current_user_can('manage_options')) { wp_die('Administrator access required.', '', array('response'=>403)); }
        check_admin_referer('calorietoken_review_export');
        $report = self::snapshot();
        nocache_headers();
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="calorietoken-site-review.json"');
        header('X-Content-Type-Options: nosniff');
        echo wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
    public static function page() {
        if (!current_user_can('manage_options')) { return; }
        $report = self::snapshot();
        echo '<div class="wrap"><h1>CalorieToken review</h1><p>Site Style <strong>' . esc_html(Plugin::VERSION) . '</strong></p>';
        echo '<p>Use this inventory with your desktop and phone review. The WordPress package and the CalorieApp deployment have separate versions.</p>';
        echo '<p>' . esc_html($report['coverage']) . '</p>';
        if ($report['truncated']) { echo '<p><strong>Only the first ' . esc_html((string) self::LIMIT) . ' records are shown. This inventory is incomplete.</strong></p>'; }
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="calorietoken_review_export">';
        wp_nonce_field('calorietoken_review_export');
        submit_button('Download private review inventory', 'secondary', 'submit', false);
        echo '</form><p>The inventory includes unpublished page titles. Keep it with your private project review files.</p>';
        echo '<table class="widefat striped"><thead><tr><th>ID</th><th>Page</th><th>Status</th><th>Stored-content review</th></tr></thead><tbody>';
        foreach ($report['pages'] as $row) {
            echo '<tr><td>' . esc_html((string) $row['id']) . '</td><td>';
            if ($row['url']) { echo '<a href="' . esc_url($row['url']) . '">' . esc_html($row['title']) . '</a>'; }
            else { echo esc_html($row['title']); }
            echo '</td><td>' . esc_html($row['status']) . '</td><td>' . esc_html($row['source_flags'] ? implode('; ', $row['source_flags']) : 'No matching legacy marker; visual review still needed') . '</td></tr>';
        }
        echo '</tbody></table></div>';
    }
}
add_action('admin_menu', array(Review::class, 'register'));
add_action('admin_post_calorietoken_review_export', array(Review::class, 'export'));
