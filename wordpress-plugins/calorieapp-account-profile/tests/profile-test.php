<?php
namespace CalorieApp\IdentityBridge {
    class Plugin {
        public static function get_options(): array {
            return ['calorieapp_backend_url'=>'https://backend.example','bridge_secret'=>'synthetic-secret','backend_client_id'=>'calorieapp-backend'];
        }
    }
}
namespace {
    define('ABSPATH', __DIR__);
    class CapturedResponse extends \Exception {
        public $data; public $status;
        public function __construct($data, $status) { $this->data=$data; $this->status=$status; parent::__construct('Captured response'); }
    }
    $logged_in=true; $user_id=123; $calls=[]; $uncached=false;
    function add_action($name,$callback,$priority=10) {}
    function nocache_headers() { $GLOBALS['uncached']=true; }
    function wp_send_json($data,$status=200) { throw new CapturedResponse($data,$status); }
    function is_user_logged_in() { return $GLOBALS['logged_in']; }
    function get_current_user_id() { return $GLOBALS['user_id']; }
    function home_url($path) { return 'https://calorietoken.net'.$path; }
    function wp_parse_url($url,$component) { return parse_url($url,$component); }
    function wp_json_encode($data,$flags=0) { return json_encode($data,$flags); }
    function is_wp_error($value) { return false; }
    function wp_remote_retrieve_response_code($response) { return $response['code']; }
    function wp_remote_retrieve_body($response) { return $response['body']; }
    function check($condition,$message) { if (!$condition) throw new \RuntimeException($message); }
    function wp_safe_remote_post($url,$options) {
        $GLOBALS['calls'][]=[$url,$options];
        check($url==='https://backend.example/api/identity/profile/wordpress','Fixed backend path');
        check($options['redirection']===0,'No redirect');
        $headers=$options['headers'];
        $subject='wp:calorietoken.net:'.$GLOBALS['user_id'];
        check(json_decode($options['body'],true)===['external_subject'=>$subject],'Account comes from WP authentication');
        $canonical=json_encode(['version'=>'v1','client_id'=>'calorieapp-backend','timestamp'=>$headers['X-CalorieApp-Timestamp'],'nonce'=>$headers['X-CalorieApp-Nonce'],'state'=>'account-profile-v1:'.$subject],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
        check(hash_equals(hash_hmac('sha256',$canonical,'synthetic-secret'),$headers['X-CalorieApp-Signature']),'Signature binds account and purpose');
        return ['code'=>200,'body'=>'{"nickname":"Piet"}'];
    }
    require dirname(__DIR__).'/calorieapp-account-profile.php';
    function call_profile() { try { \CalorieApp\AccountProfile\read_profile(); } catch (CapturedResponse $result) { return $result; } throw new \RuntimeException('No response'); }
    $_SERVER['HTTP_X_CALORIEAPP_REQUEST']='account-profile-widget';
    $_REQUEST['user_id']=999; $_REQUEST['external_subject']='wp:calorietoken.net:999';
    $result=call_profile();
    check($result->status===200&&$result->data===['nickname'=>'Piet']&&$uncached,'Private response contains only nickname and cannot be cached');
    check(count($calls)===1,'Single backend request');
    $logged_in=false; $result=call_profile();check($result->data===['nickname'=>null]&&count($calls)===1,'Guest cannot contact backend');
    $logged_in=true; unset($_SERVER['HTTP_X_CALORIEAPP_REQUEST']);$result=call_profile();check($result->status===403&&count($calls)===1,'Simple cross-site request rejected');
    echo "Profile PHP checks passed\n";
}
