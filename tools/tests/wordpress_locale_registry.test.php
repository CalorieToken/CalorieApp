<?php

define('ABSPATH', dirname(__DIR__, 2));
require dirname(__DIR__, 2)
    . '/wordpress-plugins/calorieapp-identity-bridge/includes/'
    . 'class-calorieapp-identity-bridge-locale-registry.php';

use CalorieApp\IdentityBridge\LocaleRegistry;

$expected = ['en', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'id', 'ur', 'nl'];

if (LocaleRegistry::tags() !== $expected) {
    throw new RuntimeException('WordPress locale membership or order drifted.');
}
if (LocaleRegistry::resolve('zh-CN') !== 'zh-Hans') {
    throw new RuntimeException('WordPress Chinese alias resolution failed.');
}
if (LocaleRegistry::resolve('pt_BR') !== 'pt') {
    throw new RuntimeException('WordPress underscore alias resolution failed.');
}
if (LocaleRegistry::resolve('de-DE') !== 'en') {
    throw new RuntimeException('WordPress locale fallback must remain English.');
}
if (LocaleRegistry::direction('ar') !== 'rtl' || LocaleRegistry::direction('ur-PK') !== 'rtl') {
    throw new RuntimeException('WordPress RTL resolution failed.');
}
if (LocaleRegistry::direction('nl') !== 'ltr') {
    throw new RuntimeException('WordPress LTR resolution failed.');
}

$config_path = dirname(__DIR__, 2)
    . '/wordpress-plugins/calorieapp-identity-bridge/config/locales.json';
$original_config = file_get_contents($config_path);
if (!is_string($original_config)) {
    throw new RuntimeException('Unable to read the WordPress locale registry fixture.');
}

$registry_cache = new ReflectionProperty(LocaleRegistry::class, 'registry');
$registry_cache->setAccessible(true);

try {
    $corrupted_config = json_encode([
        'source_locale' => 'en',
        'fallback_locale' => 'en',
        'locales' => [null, ['tag' => 'ar', 'direction' => 'rtl', 'aliases' => []]],
    ]);
    if (!is_string($corrupted_config) || file_put_contents($config_path, $corrupted_config) === false) {
        throw new RuntimeException('Unable to create the corrupted locale registry fixture.');
    }

    $registry_cache->setValue(null, null);
    if (LocaleRegistry::tags() !== ['en']) {
        throw new RuntimeException('A malformed WordPress locale registry must fail safely.');
    }
    if (LocaleRegistry::resolve('ar') !== 'en' || LocaleRegistry::direction('ar') !== 'ltr') {
        throw new RuntimeException('Malformed registry fallback must remain safe English LTR.');
    }
} finally {
    if (file_put_contents($config_path, $original_config) === false) {
        throw new RuntimeException('Unable to restore the WordPress locale registry fixture.');
    }
    $registry_cache->setValue(null, null);
}

if (LocaleRegistry::tags() !== $expected) {
    throw new RuntimeException('WordPress locale registry did not recover after fallback testing.');
}
