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
