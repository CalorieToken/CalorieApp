<?php
/** Private preparation tool. See README.md for scope and verification status. */
namespace CalorieToken\ContentWorkbench;

final class ContentEngine {
    const MAX_BYTES = 5242880;

    public static function decode($source) {
        if (!is_string($source) || strlen($source) > self::MAX_BYTES) {
            throw new \RuntimeException('Source is missing or larger than 5 MiB.');
        }
        $data = json_decode($source, false, 128, JSON_THROW_ON_ERROR);
        if (!is_object($data) && !is_array($data)) {
            throw new \RuntimeException('Expected a Brizy JSON object or array.');
        }
        return $data;
    }

    private static function pointer($path, $key) {
        return $path . '/' . str_replace(array('~', '/'), array('~0', '~1'), (string) $key);
    }

    private static function walk($node, $path, &$slots, &$types, $depth = 0) {
        if ($depth > 120) {
            throw new \RuntimeException('Source nesting exceeds the supported limit.');
        }
        if (is_object($node) && isset($node->type) && is_string($node->type)) {
            $types[$node->type] = isset($types[$node->type]) ? $types[$node->type] + 1 : 1;
            if ($node->type === 'RichText' && isset($node->value->text) && is_string($node->value->text)) {
                $slots[$path . '/value/text'] = $node->value->text;
            }
        }
        if (is_object($node) || is_array($node)) {
            foreach ($node as $key => $child) {
                if (is_object($child) || is_array($child)) {
                    self::walk($child, self::pointer($path, $key), $slots, $types, $depth + 1);
                }
            }
        }
    }

    public static function tokens($html) {
        // Keep original tags, attributes, comments and quoting byte-for-byte.
        $pattern = '~(<!--.*?-->|<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>)~s';
        $parts = preg_split($pattern, $html, -1, PREG_SPLIT_DELIM_CAPTURE);
        if ($parts === false) {
            throw new \RuntimeException('Cannot tokenize this text field.');
        }
        return $parts;
    }

    public static function inventory($source) {
        $slots = array();
        $types = array();
        self::walk(self::decode($source), '', $slots, $types);
        $result = array();
        foreach ($slots as $path => $html) {
            $segments = array();
            foreach (self::tokens($html) as $index => $part) {
                if ($index % 2 === 0 && $part !== '') {
                    $segments[] = array('index' => $index, 'before' => $part);
                }
            }
            $result[] = array(
                'path' => $path, 'sha256' => hash('sha256', $html),
                'html' => $html, 'segments' => $segments,
                'editable' => !preg_match('~<(script|style|iframe|object|embed)\b|\{\{~i', $html),
            );
        }
        ksort($types);
        return array('sha256' => hash('sha256', $source), 'slots' => $result, 'component_counts' => $types);
    }

    private static function rewrite(&$node, $path, $replacements) {
        if (is_object($node) && isset($node->type) && $node->type === 'RichText' &&
            isset($node->value->text) && array_key_exists($path . '/value/text', $replacements)) {
            $node->value->text = $replacements[$path . '/value/text'];
        }
        if (is_object($node) || is_array($node)) {
            foreach ($node as $key => &$child) {
                if (is_object($child) || is_array($child)) {
                    self::rewrite($child, self::pointer($path, $key), $replacements);
                }
            }
            unset($child);
        }
    }

    public static function apply($source, $expected_hash, $edits) {
        if (!is_string($expected_hash) || !hash_equals(hash('sha256', $source), $expected_hash)) {
            throw new \RuntimeException('Source changed. Inspect again before preparing a new batch.');
        }
        if (!is_array($edits) || count($edits) < 1 || count($edits) > 300) {
            throw new \RuntimeException('A page needs 1–300 text-field edits.');
        }
        $inventory = self::inventory($source);
        $slots = array_column($inventory['slots'], null, 'path');
        $replacements = array();
        foreach ($edits as $edit) {
            if (!is_array($edit) || !isset($edit['path'], $edit['sha256'], $edit['segments']) ||
                !is_string($edit['path']) || !isset($slots[$edit['path']]) || isset($replacements[$edit['path']])) {
                throw new \RuntimeException('Unknown or repeated RichText path.');
            }
            $slot = $slots[$edit['path']];
            if (!$slot['editable'] || !is_string($edit['sha256']) || !hash_equals($slot['sha256'], $edit['sha256'])) {
                throw new \RuntimeException('Text field changed or contains unsupported dynamic content.');
            }
            if (!is_array($edit['segments']) || !$edit['segments'] || count($edit['segments']) > 500) {
                throw new \RuntimeException('Expected 1–500 text segments.');
            }
            $parts = self::tokens($slot['html']);
            $seen = array();
            foreach ($edit['segments'] as $segment) {
                if (!is_array($segment) || !isset($segment['index'], $segment['before'], $segment['after']) ||
                    !is_int($segment['index']) || $segment['index'] < 0 || $segment['index'] % 2 !== 0 ||
                    !array_key_exists($segment['index'], $parts) || isset($seen[$segment['index']]) ||
                    !is_string($segment['before']) || !is_string($segment['after']) ||
                    $parts[$segment['index']] !== $segment['before']) {
                    throw new \RuntimeException('Text segment is stale, repeated or targets markup.');
                }
                if (strlen($segment['after']) > 100000 || preg_match('/\{\{|\[[a-z_\/]/i', $segment['after']) ||
                    !preg_match('//u', $segment['after'])) {
                    throw new \RuntimeException('Replacement must be ordinary UTF-8 text without dynamic instructions.');
                }
                $seen[$segment['index']] = true;
                $parts[$segment['index']] = htmlspecialchars($segment['after'], ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');
            }
            $after = implode('', $parts);
            if ($after === $slot['html']) {
                throw new \RuntimeException('Empty edit: the text would not change.');
            }
            $replacements[$edit['path']] = $after;
        }
        $data = self::decode($source);
        self::rewrite($data, '', $replacements);
        $output = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
        if (strlen($output) > self::MAX_BYTES) {
            throw new \RuntimeException('Result exceeds the source size limit.');
        }
        return $output;
    }
}
