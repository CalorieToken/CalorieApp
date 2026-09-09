<?php
// Synthetic fixtures only. This script never connects to WordPress or a provider.
define('ABSPATH', __DIR__);
define('BRIZY_VERSION', '2.8.21');
define('MINUTE_IN_SECONDS', 60);
function is_admin() { return false; }
require __DIR__ . '/../calorie-content-workbench/calorie-content-workbench.php';
use CalorieToken\ContentWorkbench\ContentEngine;
use CalorieToken\ContentWorkbench\Workbench;

$checks = 0;
function check($condition, $message) {
    global $checks;
    ++$checks;
    if (!$condition) { throw new RuntimeException($message); }
}
function rejects($callback, $fragment) {
    try { $callback(); } catch (Throwable $error) {
        check(strpos($error->getMessage(), $fragment) !== false, 'Wrong rejection: ' . $error->getMessage());
        return;
    }
    throw new RuntimeException('Expected rejection: ' . $fragment);
}
function call_private($name, ...$arguments) {
    $method = new ReflectionMethod(Workbench::class, $name);
    $method->setAccessible(true);
    return $method->invoke(null, ...$arguments);
}
function fixture_source() {
    return json_encode((object) array('items' => array(
        (object) array('type' => 'RichText', 'value' => (object) array('text' => '<p class="old" data-note="a>b"><span style="color:blue">C</span><span style="color:black">urrent </span><strong>example</strong></p>', 'width' => 1.0, 'style' => (object) array())),
        (object) array('type' => 'Form', 'value' => (object) array('text' => 'Private form configuration')),
        (object) array('type' => 'GlobalBlock', 'value' => (object) array('id' => 'synthetic-shared-reference')),
    ), 'unrelated' => (object) array('0' => 'kept', 'empty' => array())), JSON_PRESERVE_ZERO_FRACTION);
}
function fixture_edits($source, $after = 'Historical ') {
    $slot = ContentEngine::inventory($source)['slots'][0];
    return array(array('path' => $slot['path'], 'sha256' => $slot['sha256'], 'segments' => array(
        array('index' => 4, 'before' => 'C', 'after' => substr($after, 0, 1)),
        array('index' => 8, 'before' => 'urrent ', 'after' => substr($after, 1)),
    )));
}
$source = fixture_source();
$inventory = ContentEngine::inventory($source);
check(count($inventory['slots']) === 1, 'Form configuration must not become an editable slot.');
check($inventory['slots'][0]['segments'][0]['index'] === 4, 'Token indexes must account for quoted greater-than signs.');
check($inventory['component_counts']['GlobalBlock'] === 1, 'Shared component is counted without mutation.');
$edits = fixture_edits($source);
$after = ContentEngine::apply($source, hash('sha256', $source), $edits);
$parsed = json_decode($after);
check(strpos($parsed->items[0]->value->text, '>H</span><span style="color:black">istorical </span>') !== false, 'Coloured initial and following text changed separately.');
check($parsed->items[0]->value->style instanceof stdClass, 'Empty objects must stay objects.');
check(is_float($parsed->items[0]->value->width), '1.0 must retain its numeric type.');
check(json_encode($parsed->items[1]) === json_encode(json_decode($source)->items[1]), 'Form configuration changed.');
check(json_encode($parsed->items[2]) === json_encode(json_decode($source)->items[2]), 'Shared reference changed.');
check(json_encode($parsed->unrelated) === json_encode(json_decode($source)->unrelated), 'Other object keys changed.');
$old_tags = array_filter(ContentEngine::tokens($inventory['slots'][0]['html']), function ($key) { return $key % 2 === 1; }, ARRAY_FILTER_USE_KEY);
$new_tags = array_filter(ContentEngine::tokens($parsed->items[0]->value->text), function ($key) { return $key % 2 === 1; }, ARRAY_FILTER_USE_KEY);
check($old_tags === $new_tags, 'HTML tags, classes and attributes must be byte-identical.');
rejects(function () use ($source, $edits) { ContentEngine::apply($source, str_repeat('0', 64), $edits); }, 'Source changed');
$bad = $edits; $bad[0]['path'] = '/items/1/value/text';
rejects(function () use ($source, $bad) { ContentEngine::apply($source, hash('sha256', $source), $bad); }, 'Unknown');
$bad = $edits; $bad[0]['sha256'] = str_repeat('0', 64);
rejects(function () use ($source, $bad) { ContentEngine::apply($source, hash('sha256', $source), $bad); }, 'Text field changed');
$bad = $edits; $bad[0]['segments'][0]['index'] = 3;
rejects(function () use ($source, $bad) { ContentEngine::apply($source, hash('sha256', $source), $bad); }, 'targets markup');
$bad = $edits; $bad[0]['segments'][0]['before'] = 'newer';
rejects(function () use ($source, $bad) { ContentEngine::apply($source, hash('sha256', $source), $bad); }, 'stale');
$bad = $edits; $bad[0]['segments'][] = $bad[0]['segments'][0];
rejects(function () use ($source, $bad) { ContentEngine::apply($source, hash('sha256', $source), $bad); }, 'repeated');
rejects(function () use ($source, $edits) { ContentEngine::apply($source, hash('sha256', $source), array_merge($edits, $edits)); }, 'repeated RichText');
$bad = $edits; $bad[0]['segments'][0]['after'] = '[shortcode action="execute"]';
rejects(function () use ($source, $bad) { ContentEngine::apply($source, hash('sha256', $source), $bad); }, 'ordinary UTF-8');
$bad[0]['segments'][0]['after'] = '{{dynamic}}';
rejects(function () use ($source, $bad) { ContentEngine::apply($source, hash('sha256', $source), $bad); }, 'ordinary UTF-8');
$rtl = $edits; $rtl[0]['segments'][1]['after'] = ' تاريخي & <example> تاریخی';
$rtl_result = ContentEngine::apply($source, hash('sha256', $source), $rtl);
check(strpos(json_decode($rtl_result)->items[0]->value->text, 'تاريخي &amp; &lt;example&gt; تاریخی') !== false, 'RTL and plain text must survive while HTML input stays escaped.');
$dynamic = str_replace('example', '{{example}}', $source);
rejects(function () use ($dynamic) { ContentEngine::apply($dynamic, hash('sha256', $dynamic), fixture_edits($dynamic)); }, 'dynamic content');
rejects(function () { ContentEngine::decode('{"broken":'); }, 'Syntax');
rejects(function () { ContentEngine::decode('null'); }, 'object or array');

// Minimal stateful WordPress/Brizy doubles, to exercise write boundaries and recovery.
$state = array();
function reset_state($source) {
    global $state;
    $state = array('posts' => array(), 'meta' => array(), 'backups' => array(), 'options' => array(), 'transients' => array(), 'writes' => 0, 'backups_enabled' => true, 'fail_id' => 0, 'allowed' => true, 'next_id' => 100, 'clock' => 0);
    foreach (array(1, 2) as $id) {
        $state['posts'][$id] = (object) array('ID' => $id, 'post_title' => 'Synthetic ' . $id, 'post_type' => 'page', 'post_status' => 'draft', 'post_modified_gmt' => '2026-01-01 00:00:00');
        $state['meta'][$id]['brizy'] = array('brizy-post' => array('editor_data' => base64_encode($source)));
        $state['meta'][$id]['brizy_data_version'] = 7;
        $state['meta'][$id]['brizy-post-compiler-version'] = '3.0.0';
    }
}
function get_post($id) { global $state; return $state['posts'][(int) $id] ?? null; }
function get_post_status($id) { return get_post($id)->post_status; }
function current_user_can($capability, ...$args) { global $state; return $state['allowed']; }
function get_current_user_id() { return 7; }
function get_post_types($args, $output) { return array('page', 'post', 'product', 'brizy-global-block', 'editor-story', 'editor-popup', 'editor-template', 'editor-form-entry', 'shop_order'); }
function post_type_exists($type) { return in_array($type, get_post_types(array(), 'names'), true); }
function get_post_meta($id, $key, $single) { global $state; return $state['meta'][$id][$key] ?? ''; }
function apply_filters($name, $value) { return $value; }
function wp_get_post_autosave($id) { global $state; return $state['autosaves'][$id] ?? null; }
function wp_slash($value) { return $value; } // All backup payload content is base64 or scalar metadata.
function add_post_meta($id, $key, $value, $unique = false) {
    global $state;
    if ($key === Workbench::BACKUP) {
        if (!$state['backups_enabled']) { return false; }
        $mid = count($state['backups']) + 1;
        $state['backups'][$mid] = (object) array('post_id' => $id, 'meta_key' => $key, 'meta_value' => $value);
        return $mid;
    }
    $state['meta'][$id][$key] = $value; return 1;
}
function get_metadata_by_mid($type, $id) { global $state; return $state['backups'][$id] ?? false; }
function wp_generate_password($length, $special, $extra) { global $state; return str_pad((string) ++$state['clock'], $length, 'a'); }
function add_option($key, $value, $deprecated, $autoload) { global $state; if (isset($state['options'][$key])) { return false; } $state['options'][$key] = $value; return true; }
function get_option($key) { global $state; return $state['options'][$key] ?? false; }
function delete_option($key) { global $state; unset($state['options'][$key]); return true; }
function maybe_serialize($value) { return serialize($value); }
function wp_cache_delete($key, $group) { return true; }
$wpdb = new class {
    public $options = 'synthetic_options';
    public function delete($table, $where, $format) {
        global $state;
        $key = $where['option_name'];
        if (isset($state['options'][$key]) && serialize($state['options'][$key]) === $where['option_value']) {
            unset($state['options'][$key]); return 1;
        }
        return 0;
    }
};
function get_transient($key) { global $state; return $state['transients'][$key] ?? false; }
function delete_transient($key) { global $state; unset($state['transients'][$key]); return true; }
function get_post_type_object($type) { return (object) array('cap' => (object) array('create_posts' => 'edit_pages')); }
function wp_insert_post($args, $error) { global $state; $id = $state['next_id']++; $state['posts'][$id] = (object) array_merge($args, array('ID' => $id, 'post_modified_gmt' => '2026-01-01 00:00:00')); return $id; }
function is_wp_error($value) { return false; }
class Brizy_Editor_Post {
    public $id; public $data; public $nextVersion = null;
    public static function get($id) { $item = new self(); $item->id = $id; $item->data = get_post_meta($id, 'brizy', true)['brizy-post']['editor_data']; return $item; }
    public function getEditorData($decode = false) { return $decode ? base64_decode($this->data, true) : $this->data; }
    public function setEditorData($data) { $this->data = $data; return $this; }
    public function getCurrentDataVersion() { return (int) get_post_meta($this->id, 'brizy_data_version', true); }
    public function setDataVersion($version) { $this->nextVersion = (int) $version; return $this; }
    public function set_needs_compile($value) { global $state; $state['meta'][$this->id]['brizy-need-compile'] = $value; return $this; }
    public function set_compiler_version($value) { global $state; $state['meta'][$this->id]['brizy-post-compiler-version'] = $value; }
    public function save($autosave = 0) {
        global $state;
        if (($state['race_id'] ?? 0) === $this->id) { ++$state['meta'][$this->id]['brizy_data_version']; }
        if ($this->nextVersion !== $this->getCurrentDataVersion() + 1) { throw new RuntimeException('Unable to save entity. The data version is wrong.'); }
        if ($state['fail_id'] === $this->id) { throw new RuntimeException('Synthetic storage failure.'); }
        $state['meta'][$this->id]['brizy_data_version'] = $this->nextVersion;
        $state['meta'][$this->id]['brizy']['brizy-post']['editor_data'] = $this->data;
        ++$state['writes']; return true;
    }
    public function duplicateTo($id) { global $state; $state['meta'][$id]['brizy'] = $state['meta'][$this->id]['brizy']; return self::get($id)->setDataVersion(1); }
}
reset_state($source);
check(count(array_intersect(call_private('types'), array('editor-story', 'editor-popup', 'editor-template'))) === 3 && !in_array('editor-form-entry', call_private('types'), true), 'Inventory must include native Brizy content types while excluding leads.');
$unprepared = Brizy_Editor_Post::get(1);
rejects(function () use ($unprepared) { $unprepared->save(0); }, 'data version is wrong');
$state['posts'][1]->post_status = 'publish';
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test'); }, 'drafts');
check($state['writes'] === 0 && !$state['backups'], 'Published source must not be written or backed up as a draft operation.');
$state['posts'][1]->post_status = 'draft'; $state['posts'][1]->post_type = 'brizy-global-block';
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test'); }, 'drafts');
$state['posts'][1]->post_type = 'page'; $state['allowed'] = false;
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test'); }, 'unavailable');
$state['allowed'] = true; $state['meta'][1]['_edit_lock'] = time() . ':7';
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test'); }, 'editor is still open');
unset($state['meta'][1]['_edit_lock']);
$state['autosaves'][1] = (object) array('post_modified_gmt' => '2026-01-02 00:00:00');
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test'); }, 'newer native autosave');
unset($state['autosaves']); $state['backups_enabled'] = false;
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test'); }, 'Backup failed');
check($state['writes'] === 0, 'Failed backup must stop before source write.');
$state['backups_enabled'] = true;
$backup_id = call_private('save_source', 1, $source, $after, 'test');
check($state['writes'] === 1 && $state['meta'][1]['brizy-need-compile'] === true && get_post_status(1) === 'draft', 'Save must preserve draft status and invalidate compiled output.');
check($state['meta'][1]['brizy-post-compiler-version'] === '0.0.0' && $state['meta'][2]['brizy-post-compiler-version'] === '3.0.0', 'Brizy native preview needs the stale compiler marker on the saved draft only.');
check($state['meta'][1]['brizy_data_version'] === 8, 'An existing nonzero native version must advance exactly once.');
check(base64_decode($state['backups'][$backup_id]->meta_value['before_base64']) === $source, 'Original bytes must be retained.');
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test'); }, 'changed since preview');
$state['meta'][1]['brizy-post-compiler-version'] = '3.0.0'; // Model a native compile after the saved batch.
call_private('restore', 1, $backup_id);
check(call_private('source', 1) === $source, 'Restore must recover the exact original source bytes.');
check($state['meta'][1]['brizy-post-compiler-version'] === '0.0.0', 'Restored source must invalidate the previously compiled changed copy.');
check($state['meta'][1]['brizy_data_version'] === 9, 'Restore must follow the same native version contract.');
check(count($state['backups']) === 2 && !$state['options'], 'Restore must itself be reversible and release its mutex.');
rejects(function () use ($backup_id) { call_private('restore', 2, $backup_id); }, 'does not belong');
rejects(function () use ($backup_id) { call_private('restore', 1, $backup_id); }, 'newer changes');

reset_state($source);
$state['race_id'] = 1;
rejects(function () use ($source, $after) { call_private('save_source', 1, $source, $after, 'test-race'); }, 'data version is wrong');
check($state['writes'] === 0 && call_private('source', 1) === $source, 'A concurrent native version change must still prevent source overwrite.');
check($state['meta'][1]['brizy-post-compiler-version'] === '3.0.0', 'Rejected source writes must not invalidate the existing compiled cache.');
reset_state($source);
$token = str_repeat('p', 32);
$state['transients']['ctcw_plan_' . $token] = array('user' => 7, 'version' => Workbench::VERSION, 'jobs' => array(
    array('id' => 1, 'before' => $source, 'after' => $after), array('id' => 2, 'before' => $source, 'after' => $after)));
$state['meta'][2]['brizy']['brizy-post']['editor_data'] = base64_encode($after);
rejects(function () use ($token) { call_private('apply_plan', $token); }, 'Batch is stale on page 2');
check($state['writes'] === 0 && !$state['options'], 'A stale second page must prevent writes to the first.');
$state['meta'][2]['brizy']['brizy-post']['editor_data'] = base64_encode($source); $state['fail_id'] = 2;
rejects(function () use ($token) { call_private('apply_plan', $token); }, 'Completed: page 1 (backup 1)');
check($state['writes'] === 1 && count($state['backups']) === 2 && !$state['options'] && !$state['transients'], 'Partial failure must retain backups, report completed pages and invalidate replay.');
reset_state($source);
$state['posts'][1]->post_status = 'publish';
call_private('clone_draft', 1, hash('sha256', $source));
check(get_post_status(1) === 'publish' && get_post_status(100) === 'draft', 'Clone must leave the original published and create a draft.');
check(call_private('source', 1) === $source && call_private('source', 100) === $source, 'Source and clone must match.');
check($state['meta'][100]['brizy-need-compile'] === true, 'Clone requires native compilation.');
check($state['meta'][100]['brizy-post-compiler-version'] === '0.0.0' && $state['meta'][1]['brizy-post-compiler-version'] === '3.0.0', 'A copy without compiled sections must trigger native compilation without invalidating its published original.');
$old_lock = array('token' => 'old', 'time' => 1);
$state['options'][Workbench::MUTEX] = array('token' => 'new', 'time' => 2);
check(call_private('release_mutex', $old_lock) === false && $state['options'][Workbench::MUTEX]['token'] === 'new', 'Releasing an abandoned lock must retain a newer operation lock.');
echo 'PASS ' . $checks . " focused assertions; synthetic WordPress/Brizy state only.\n";
