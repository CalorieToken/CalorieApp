<?php

namespace CalorieApp\IdentityBridge;

if (!defined('ABSPATH')) {
    exit;
}

final class LocaleRegistry {
    private static ?array $registry = null;

    public static function all(): array {
        if (self::$registry !== null) {
            return self::$registry;
        }

        $path = dirname(__DIR__) . '/config/locales.json';
        $contents = is_readable($path) ? file_get_contents($path) : false;
        $decoded = is_string($contents) ? json_decode($contents, true) : null;

        if (!is_array($decoded) || !isset($decoded['locales']) || !is_array($decoded['locales'])) {
            self::$registry = self::fallback_registry();
            return self::$registry;
        }

        self::$registry = $decoded;
        return self::$registry;
    }

    public static function tags(): array {
        return array_values(
            array_map(
                static fn(array $locale): string => (string) $locale['tag'],
                self::all()['locales']
            )
        );
    }

    public static function resolve(?string $requested): string {
        $registry = self::all();
        $identifiers = [];
        $canonical_primary_tags = [];

        foreach ($registry['locales'] as $locale) {
            $tag = (string) $locale['tag'];
            $identifiers[self::normalize_identifier($tag)] = $tag;
            foreach ((array) ($locale['aliases'] ?? []) as $alias) {
                $identifiers[self::normalize_identifier((string) $alias)] = $tag;
            }
            if (strpos($tag, '-') === false) {
                $canonical_primary_tags[strtolower($tag)] = $tag;
            }
        }

        foreach (explode(',', (string) $requested) as $part) {
            $candidate = trim(explode(';', $part, 2)[0]);
            if ($candidate === '' || $candidate === '*') {
                continue;
            }
            $normalized = self::normalize_identifier($candidate);
            if (isset($identifiers[$normalized])) {
                return $identifiers[$normalized];
            }
            $primary = explode('-', $normalized, 2)[0];
            if (isset($canonical_primary_tags[$primary])) {
                return $canonical_primary_tags[$primary];
            }
        }

        return (string) ($registry['fallback_locale'] ?? 'en');
    }

    public static function direction(?string $requested): string {
        $resolved = self::resolve($requested);
        foreach (self::all()['locales'] as $locale) {
            if ((string) $locale['tag'] === $resolved) {
                return (string) $locale['direction'];
            }
        }
        return 'ltr';
    }

    private static function normalize_identifier(string $value): string {
        return strtolower(str_replace('_', '-', trim($value)));
    }

    private static function fallback_registry(): array {
        return [
            'source_locale' => 'en',
            'fallback_locale' => 'en',
            'locales' => [
                [
                    'tag' => 'en',
                    'english_name' => 'English',
                    'native_name' => 'English',
                    'direction' => 'ltr',
                    'source' => true,
                    'aliases' => [],
                ],
            ],
        ];
    }
}
