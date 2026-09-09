<?php
/**
 * Plugin Name: Calorie Content Workbench
 * Description: Private admin workspace for Brizy inventory and reversible draft text batches.
 * Version: 0.1.2
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */
namespace CalorieToken\ContentWorkbench;

if (!defined('ABSPATH')) { exit; }
require_once __DIR__ . '/includes/class-content-engine.php';

final class Workbench {
    const VERSION = '0.1.2';
    const PAGE = 'calorie-content-workbench';
    const BACKUP = '_ctcw_backup_v1';
    const MUTEX = 'ctcw_operation_lock_v1';

    public static function boot() {
        add_action('admin_menu', function () {
            add_management_page('Calorie Content Workbench', 'Calorie Content Workbench', 'manage_options', self::PAGE, array(__CLASS__, 'page'));
        });
    }

    private static function supported() {
        if (!defined('BRIZY_VERSION') || BRIZY_VERSION !== '2.8.21') {
            throw new \RuntimeException('This preparation build supports Brizy 2.8.21 only. Inventory remains available.');
        }
        foreach (array('get', 'duplicateTo', 'getEditorData', 'setEditorData', 'getCurrentDataVersion', 'setDataVersion', 'set_needs_compile', 'set_compiler_version', 'save') as $method) {
            if (!is_callable(array('Brizy_Editor_Post', 'get')) || !method_exists('Brizy_Editor_Post', $method)) {
                throw new \RuntimeException('Required Brizy methods are unavailable. No draft write was started.');
            }
        }
    }

    private static function post($id, $draft = false) {
        $post = get_post((int) $id);
        if (!$post || !current_user_can('edit_post', $post->ID)) {
            throw new \RuntimeException('This content is unavailable to the current administrator.');
        }
        if ($draft && (!in_array($post->post_type, array('page', 'post'), true) || $post->post_status !== 'draft')) {
            throw new \RuntimeException('Writes are restricted to ordinary page/post drafts.');
        }
        if (!in_array($post->post_type, self::types(), true) || in_array($post->post_status, array('trash', 'auto-draft', 'inherit'), true)) {
            throw new \RuntimeException('This content type or status is outside the inventory scope.');
        }
        return $post;
    }

    private static function types() {
        $types = array('page', 'post', 'product', 'editor-story', 'editor-popup', 'editor-template');
        foreach (get_post_types(array(), 'names') as $type) {
            if (strpos($type, 'brizy') === 0) { $types[] = $type; }
        }
        return array_values(array_filter(array_unique($types), 'post_type_exists'));
    }

    private static function source($id) {
        // Read the documented 2.8.21 storage shape without constructing an editor
        // object: Brizy's constructor can itself save metadata during migration.
        $storage = get_post_meta($id, 'brizy', true);
        if (!is_array($storage) || !isset($storage['brizy-post']) || !is_array($storage['brizy-post']) ||
            !isset($storage['brizy-post']['editor_data']) || !is_string($storage['brizy-post']['editor_data'])) {
            throw new \RuntimeException('No supported Brizy source record. Use its native editor; no content was changed.');
        }
        $packed = $storage['brizy-post']['editor_data'];
        if (strlen($packed) > 6990600) { throw new \RuntimeException('Encoded source exceeds the supported limit.'); }
        $source = base64_decode($packed, true);
        if ($source === false) { throw new \RuntimeException('Unsupported Brizy source encoding.'); }
        ContentEngine::decode($source);
        return $source;
    }

    private static function unlocked($id) {
        $lock = explode(':', (string) get_post_meta($id, '_edit_lock', true));
        $window = max(150, (int) apply_filters('wp_check_post_lock_window', 150));
        if ((int) $lock[0] > time() - $window) {
            throw new \RuntimeException('An editor is still open for this page, including your own editor. Leave that editor and allow its lock to expire.');
        }
        $autosave = wp_get_post_autosave($id);
        $post = get_post($id);
        if ($autosave && $autosave->post_modified_gmt > $post->post_modified_gmt) {
            throw new \RuntimeException('A newer native autosave exists. Inspect it before applying a text batch.');
        }
    }

    private static function inspect($id) {
        global $wpdb;
        $post = self::post($id);
        $result = array(
            'schema' => 'calorie-content-inventory/v1', 'post_id' => $post->ID,
            'title' => $post->post_title, 'type' => $post->post_type, 'status' => $post->post_status,
            'modified_gmt' => $post->post_modified_gmt,
            'brizy_version' => defined('BRIZY_VERSION') ? BRIZY_VERSION : null,
        );
        try { $result += ContentEngine::inventory(self::source($post->ID)); }
        catch (\Throwable $error) { $result['source_status'] = $error->getMessage(); }
        $result['workbench_backups'] = array();
        $backup_ids = $wpdb->get_col($wpdb->prepare("SELECT meta_id FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = %s ORDER BY meta_id DESC LIMIT 20", $post->ID, self::BACKUP));
        foreach ($backup_ids as $backup_id) {
            $record = get_metadata_by_mid('post', $backup_id);
            if ($record && is_array($record->meta_value)) {
                $result['workbench_backups'][] = array('backup_id' => (int) $backup_id, 'created_gmt' => $record->meta_value['created_gmt'], 'reason' => $record->meta_value['reason'], 'after_sha256' => $record->meta_value['after_sha256']);
            }
        }
        return $result;
    }

    private static function read_batch() {
        $json = isset($_POST['batch']) && is_string($_POST['batch']) ? wp_unslash($_POST['batch']) : '';
        if (isset($_FILES['batch_file']) && (int) $_FILES['batch_file']['error'] !== UPLOAD_ERR_NO_FILE) {
            $upload = $_FILES['batch_file'];
            if ($json !== '' || $upload['error'] !== UPLOAD_ERR_OK || $upload['size'] > 1048576 || !is_uploaded_file($upload['tmp_name'])) {
                throw new \RuntimeException('Provide one valid JSON upload, at most 1 MiB, or use the text box.');
            }
            $json = file_get_contents($upload['tmp_name']);
        }
        if (!is_string($json) || strlen($json) > 1048576) { throw new \RuntimeException('Batch exceeds 1 MiB.'); }
        $batch = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($batch) || !isset($batch['schema'], $batch['jobs']) || $batch['schema'] !== 'calorie-content-batch/v1' ||
            !is_array($batch['jobs']) || count($batch['jobs']) < 1 || count($batch['jobs']) > 10) {
            throw new \RuntimeException('Expected 1–10 jobs in a calorie-content-batch/v1 file.');
        }
        return $batch['jobs'];
    }

    private static function prepare() {
        self::supported();
        $jobs = self::read_batch();
        $prepared = array();
        $seen = array();
        $total = 0;
        foreach ($jobs as $job) {
            if (!is_array($job) || !isset($job['post_id'], $job['source_sha256'], $job['edits']) ||
                !is_int($job['post_id']) || isset($seen[$job['post_id']])) {
                throw new \RuntimeException('Invalid or repeated page in batch.');
            }
            $post = self::post($job['post_id'], true);
            self::unlocked($post->ID);
            $before = self::source($post->ID);
            $after = ContentEngine::apply($before, $job['source_sha256'], $job['edits']);
            $total += strlen($before) + strlen($after);
            if ($total > 10485760) { throw new \RuntimeException('Batch sources exceed 10 MiB. Prepare fewer pages together.'); }
            $seen[$post->ID] = true;
            $prepared[] = array('id' => $post->ID, 'title' => $post->post_title, 'before' => $before, 'after' => $after, 'edits' => $job['edits']);
        }
        $token = wp_generate_password(32, false, false);
        if (!set_transient('ctcw_plan_' . $token, array('user' => get_current_user_id(), 'version' => self::VERSION, 'jobs' => $prepared), 30 * MINUTE_IN_SECONDS)) {
            throw new \RuntimeException('Could not retain the preview. No page was changed.');
        }
        return array('token' => $token, 'jobs' => $prepared);
    }

    private static function save_source($id, $before, $after, $reason) {
        self::supported();
        self::post($id, true);
        self::unlocked($id);
        if (!hash_equals(hash('sha256', $before), hash('sha256', self::source($id)))) {
            throw new \RuntimeException('Page ' . $id . ' changed since preview. Nothing was overwritten.');
        }
        $editor = \Brizy_Editor_Post::get($id);
        // Brizy checks the caller's next version against the stored version + 1.
        // Capture before rechecking the source so a concurrent native save will
        // still fail Brizy's own version guard rather than being overwritten.
        $data_version = $editor->getCurrentDataVersion();
        if (!hash_equals(hash('sha256', $before), hash('sha256', $editor->getEditorData(true))) ||
            !hash_equals(hash('sha256', $before), hash('sha256', self::source($id)))) {
            throw new \RuntimeException('Brizy loaded a different source. Inspect it again.');
        }
        $backup = array('version' => 1, 'created_gmt' => gmdate('c'), 'user' => get_current_user_id(), 'reason' => $reason,
            'before_sha256' => hash('sha256', $before), 'after_sha256' => hash('sha256', $after), 'before_base64' => base64_encode($before));
        $backup_id = add_post_meta($id, self::BACKUP, wp_slash($backup));
        if (!$backup_id) { throw new \RuntimeException('Backup failed. No source write was attempted.'); }
        $editor->setDataVersion($data_version + 1);
        $editor->setEditorData(base64_encode($after));
        $editor->set_needs_compile(true);
        $editor->save(0);
        if (get_post_status($id) !== 'draft' || !hash_equals(hash('sha256', $after), hash('sha256', self::source($id)))) {
            throw new \RuntimeException('Readback failed for page ' . $id . '; backup ' . $backup_id . ' is retained. Inspect before another write.');
        }
        // Brizy 2.8.21's needsCompile() checks the compiled version, not its
        // needs_compile flag. Use Brizy's own stale-cache marker for this draft
        // only, after successful source storage; never reset the whole site.
        $editor->set_compiler_version('0.0.0');
        return $backup_id;
    }

    private static function with_mutex($callback) {
        $token = wp_generate_password(32, false, false);
        if (!add_option(self::MUTEX, array('token' => $token, 'time' => time()), '', false)) {
            throw new \RuntimeException('Another workbench operation is in progress. An abandoned lock can be released after 10 minutes.');
        }
        try { return call_user_func($callback); }
        finally {
            $lock = get_option(self::MUTEX);
            if (is_array($lock) && isset($lock['token']) && hash_equals($lock['token'], $token)) { self::release_mutex($lock); }
        }
    }

    private static function release_mutex($expected) {
        global $wpdb;
        // Delete only this exact helper-owned lock; a newer operation survives.
        $deleted = $wpdb->delete($wpdb->options, array('option_name' => self::MUTEX, 'option_value' => maybe_serialize($expected)), array('%s', '%s'));
        if ($deleted) { wp_cache_delete(self::MUTEX, 'options'); }
        return $deleted === 1;
    }

    private static function apply_plan($token) {
        if (!is_string($token) || !preg_match('/^[A-Za-z0-9]{32}$/D', $token)) { throw new \RuntimeException('Invalid preview token.'); }
        $plan = get_transient('ctcw_plan_' . $token);
        if (!is_array($plan) || $plan['user'] !== get_current_user_id() || $plan['version'] !== self::VERSION) {
            throw new \RuntimeException('Preview expired or belongs to another user/version. Prepare again.');
        }
        return self::with_mutex(function () use ($plan, $token) {
            // Validate the entire batch before starting any writes.
            foreach ($plan['jobs'] as $job) {
                self::post($job['id'], true);
                self::unlocked($job['id']);
                if (!hash_equals(hash('sha256', $job['before']), hash('sha256', self::source($job['id'])))) {
                    throw new \RuntimeException('Batch is stale on page ' . $job['id'] . '. No page was changed.');
                }
            }
            $done = array();
            foreach ($plan['jobs'] as $job) {
                try {
                    $backup = self::save_source($job['id'], $job['before'], $job['after'], 'text-batch');
                    $done[] = 'page ' . $job['id'] . ' (backup ' . $backup . ')';
                } catch (\Throwable $error) {
                    delete_transient('ctcw_plan_' . $token);
                    throw new \RuntimeException('Stopped at page ' . $job['id'] . '. Completed: ' . ($done ? implode(', ', $done) : 'none') . '. ' . $error->getMessage());
                }
            }
            delete_transient('ctcw_plan_' . $token);
            return 'Draft source saved and read back: ' . implode(', ', $done) . '. Open the native preview to compile and verify appearance; this is not visual acceptance.';
        });
    }

    private static function clone_draft($id, $expected_hash) {
        self::supported();
        $post = self::post($id);
        if (!in_array($post->post_type, array('page', 'post'), true)) { throw new \RuntimeException('Only ordinary pages and posts can be copied.'); }
        $before = self::source($id);
        if (!is_string($expected_hash) || !hash_equals(hash('sha256', $before), $expected_hash)) { throw new \RuntimeException('Source changed. Inspect before making a copy.'); }
        return self::with_mutex(function () use ($post, $before) {
            $type = get_post_type_object($post->post_type);
            if (!current_user_can($type->cap->create_posts)) { throw new \RuntimeException('You cannot create this content type.'); }
            self::unlocked($post->ID);
            if (!hash_equals(hash('sha256', $before), hash('sha256', self::source($post->ID)))) { throw new \RuntimeException('Source changed before copying.'); }
            $new_id = wp_insert_post(array('post_type' => $post->post_type, 'post_status' => 'draft',
                'post_title' => $post->post_title . ' — working copy', 'post_author' => get_current_user_id(),
                'comment_status' => 'closed', 'ping_status' => 'closed'), true);
            if (is_wp_error($new_id)) { throw new \RuntimeException('Could not create a draft.'); }
            add_post_meta($new_id, '_ctcw_source_page', $post->ID, true);
            try {
                $copy = \Brizy_Editor_Post::get($post->ID)->duplicateTo($new_id);
                $copy->set_needs_compile(true);
                $copy->save(0);
                if (!hash_equals(hash('sha256', $before), hash('sha256', self::source($new_id)))) { throw new \RuntimeException('Copied source did not match.'); }
                $copy->set_compiler_version('0.0.0');
            } catch (\Throwable $error) {
                throw new \RuntimeException('Draft ' . $new_id . ' was created but its Brizy copy needs inspection. Original retained. ' . $error->getMessage());
            }
            return 'Working draft created: ' . $new_id . '. Shared blocks remain references; this tool cannot edit them. Inspect the new draft before preparing its text batch.';
        });
    }

    private static function restore($id, $backup_id) {
        $record = get_metadata_by_mid('post', $backup_id);
        if (!$record || (int) $record->post_id !== $id || $record->meta_key !== self::BACKUP || !is_array($record->meta_value)) {
            throw new \RuntimeException('Backup does not belong to this page.');
        }
        $backup = $record->meta_value;
        $before = self::source($id);
        if (!hash_equals($backup['after_sha256'], hash('sha256', $before))) { throw new \RuntimeException('The draft has newer changes. Automatic restore would overwrite them and has stopped.'); }
        $after = base64_decode($backup['before_base64'], true);
        if ($after === false || !hash_equals($backup['before_sha256'], hash('sha256', $after))) { throw new \RuntimeException('Backup integrity check failed.'); }
        ContentEngine::decode($after);
        return self::with_mutex(function () use ($id, $before, $after) {
            $new_backup = self::save_source($id, $before, $after, 'restore');
            return 'Draft source restored. Recovery point ' . $new_backup . ' retained. Native compilation and preview still need checking.';
        });
    }

    private static function form($action) {
        echo '<form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('tools.php?page=' . self::PAGE)) . '">';
        wp_nonce_field('ctcw_action');
        echo '<input type="hidden" name="ctcw_action" value="' . esc_attr($action) . '">';
    }

    private static function hidden($name, $value) { echo '<input type="hidden" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '">'; }

    public static function page() {
        if (!current_user_can('manage_options')) { wp_die('Administrator access required.'); }
        $notice = ''; $error = ''; $inspection = null; $preview = null;
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            check_admin_referer('ctcw_action');
            try {
                $action = isset($_POST['ctcw_action']) ? sanitize_key($_POST['ctcw_action']) : '';
                $id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
                if ($action === 'inspect') { $inspection = self::inspect($id); }
                elseif ($action === 'prepare') { $preview = self::prepare(); }
                elseif ($action === 'apply') { $notice = self::apply_plan(isset($_POST['token']) ? wp_unslash($_POST['token']) : ''); }
                elseif ($action === 'clone') { $notice = self::clone_draft($id, isset($_POST['source_sha256']) ? wp_unslash($_POST['source_sha256']) : ''); }
                elseif ($action === 'restore') { $notice = self::restore($id, isset($_POST['backup_id']) ? absint($_POST['backup_id']) : 0); }
                elseif ($action === 'release_lock') {
                    $lock = get_option(self::MUTEX);
                    if (!is_array($lock) || !isset($lock['time']) || $lock['time'] > time() - 600) { throw new \RuntimeException('No abandoned operation lock is eligible for release.'); }
                    if (!self::release_mutex($lock)) { throw new \RuntimeException('Operation lock changed; the newer lock was retained.'); }
                    $notice = 'Abandoned workbench lock released; native editor locks remain respected.';
                } else { throw new \RuntimeException('Unknown action.'); }
            } catch (\Throwable $exception) { $error = $exception->getMessage(); }
        }
        echo '<div class="wrap"><h1>Calorie Content Workbench</h1><p>Private preparation build ' . esc_html(self::VERSION) . '. Inventory, working copies and text batches. Writes stay in page/post drafts. Native previews remain required.</p>';
        if ($notice) { echo '<div class="notice notice-success"><p>' . esc_html($notice) . '</p></div>'; }
        if ($error) { echo '<div class="notice notice-error"><p>' . esc_html($error) . '</p></div>'; }
        if ($inspection) {
            echo '<h2>Source inspection</h2><p>Only RichText fields and component counts are exposed. Form settings, credentials, user records and full editor models are not exported.</p><textarea id="ctcw-inventory" readonly rows="18" style="width:100%" aria-label="Source inventory JSON">' . esc_textarea(wp_json_encode($inspection, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . '</textarea>';
            if (isset($inspection['sha256']) && in_array($inspection['type'], array('page', 'post'), true)) {
                self::form('clone'); self::hidden('post_id', $inspection['post_id']); self::hidden('source_sha256', $inspection['sha256']);
                submit_button('Create working draft', 'secondary'); echo '</form>';
            }
        }
        if ($preview) {
            echo '<h2>Batch preview</h2><table class="widefat"><thead><tr><th>Draft</th><th>Before</th><th>After</th></tr></thead><tbody>';
            foreach ($preview['jobs'] as $job) { foreach ($job['edits'] as $edit) { foreach ($edit['segments'] as $segment) {
                echo '<tr><td>' . esc_html($job['id'] . ' — ' . $job['title']) . '</td><td dir="auto">' . esc_html(html_entity_decode($segment['before'], ENT_QUOTES | ENT_HTML5, 'UTF-8')) . '</td><td dir="auto">' . esc_html($segment['after']) . '</td></tr>';
            } } }
            echo '</tbody></table>'; self::form('apply'); self::hidden('token', $preview['token']); submit_button('Apply this batch to drafts'); echo '</form>';
        }
        echo '<h2>Content inventory</h2>';
        $page = isset($_GET['inventory_page']) ? max(1, absint($_GET['inventory_page'])) : 1;
        $query = new \WP_Query(array('post_type' => self::types(), 'post_status' => array('publish', 'draft', 'pending', 'private', 'future'), 'posts_per_page' => 100, 'paged' => $page, 'orderby' => 'ID', 'order' => 'ASC'));
        echo '<p>' . esc_html($query->found_posts . ' content records; page ' . $page . ' of ' . max(1, $query->max_num_pages)) . '. Global blocks/templates and products are inventory-only.</p><table class="widefat"><thead><tr><th>ID / title</th><th>Type / status</th><th>Actions</th></tr></thead><tbody>';
        foreach ($query->posts as $post) {
            if (!current_user_can('edit_post', $post->ID)) { continue; }
            echo '<tr><td>' . esc_html($post->ID . ' — ' . $post->post_title) . '</td><td>' . esc_html($post->post_type . ' / ' . $post->post_status) . '</td><td>';
            self::form('inspect'); self::hidden('post_id', $post->ID); echo '<button class="button" type="submit">Inspect ' . esc_html($post->ID) . '</button></form> ';
            echo '<a href="' . esc_url(get_edit_post_link($post->ID, 'raw')) . '">Native editor</a>';
            if (in_array($post->post_type, array('page', 'post'), true)) { echo ' · <a href="' . esc_url(get_preview_post_link($post)) . '">Native preview</a>'; }
            echo '</td></tr>';
        }
        echo '</tbody></table>';
        if ($page > 1) { echo '<a class="button" href="' . esc_url(add_query_arg(array('page' => self::PAGE, 'inventory_page' => $page - 1), admin_url('tools.php'))) . '">Previous inventory page</a> '; }
        if ($page < $query->max_num_pages) { echo '<a class="button" href="' . esc_url(add_query_arg(array('page' => self::PAGE, 'inventory_page' => $page + 1), admin_url('tools.php'))) . '">Next inventory page</a>'; }
        echo '<h2>Prepare a text batch</h2><p>Upload a source-bound JSON batch or paste it. Preparation validates every page and shows the exact changes before any source write.</p>';
        self::form('prepare'); echo '<p><label>Batch JSON file <input name="batch_file" type="file" accept=".json,application/json"></label></p><p><label for="ctcw-batch">Batch JSON</label><textarea id="ctcw-batch" name="batch" rows="8" style="width:100%"></textarea></p>'; submit_button('Preview batch', 'secondary'); echo '</form>';
        echo '<h2>Restore a workbench backup</h2><p>The current source must still match the saved result. Newer edits are preserved by refusing an outdated restore.</p>';
        self::form('restore'); echo '<p><label>Draft ID <input type="number" min="1" name="post_id" required></label> <label>Backup ID <input type="number" min="1" name="backup_id" required></label></p>'; submit_button('Restore draft source', 'secondary'); echo '</form>';
        $lock = get_option(self::MUTEX);
        if (is_array($lock) && isset($lock['time']) && $lock['time'] <= time() - 600) { self::form('release_lock'); submit_button('Release abandoned workbench lock', 'secondary'); echo '</form>'; }
        echo '</div>';
    }
}

if (is_admin()) { Workbench::boot(); }
