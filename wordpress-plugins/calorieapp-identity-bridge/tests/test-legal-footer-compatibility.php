<?php

use CalorieApp\IdentityBridge\LegalFooterCompatibility;

class Test_CalorieApp_Legal_Footer_Compatibility extends WP_UnitTestCase {
    public function test_replaces_known_obsolete_legal_footer_variants(): void {
        $html = '<p>Chamber of Commerce KVK: 84216352</p>'
            . '<p>Calorie Token • KvK 84216352</p>'
            . '<p>ICTHendrikse &bull; KvK 73774693</p>'
            . '<p>Operator: ICTHendrikse</p>'
            . '<p>© 2023 Calorie Token</p>'
            . '<p>&copy;&nbsp;2026&nbsp;CalorieToken</p>'
            . '<p>Calorie aims to be the World&apos;s food token</p>'
            . '<p>Tokenomics content remains unchanged.</p>';

        $result = LegalFooterCompatibility::replace_legacy_footer_html($html);

        $this->assertSame(4, substr_count($result, 'Operator: ICTHendrikse · KVK 73774693'));
        $this->assertSame(
            2,
            substr_count(
                $result,
                '© 2026 ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse'
            )
        );
        $this->assertStringContainsString(
            'Calorie aims to be the world’s food token',
            $result
        );
        $this->assertStringContainsString('Tokenomics content remains unchanged.', $result);
        $this->assertStringNotContainsString('84216352', $result);
    }

    public function test_current_footer_is_idempotent(): void {
        $html = '<footer><p>Calorie aims to be the world’s food token</p>'
            . '<p>Operator: ICTHendrikse · KVK 73774693</p>'
            . '<p>© 2026 ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse</p>'
            . '</footer>';

        $this->assertSame($html, LegalFooterCompatibility::replace_legacy_footer_html($html));
    }

    public function test_leaves_unrelated_html_unchanged(): void {
        $html = '<main><h1>CalorieApp</h1><p>Nutrition Tracking</p></main>';

        $this->assertSame($html, LegalFooterCompatibility::replace_legacy_footer_html($html));
    }
}
