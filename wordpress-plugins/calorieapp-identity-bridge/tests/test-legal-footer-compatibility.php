<?php

use CalorieApp\IdentityBridge\LegalFooterCompatibility;

class Test_CalorieApp_Legal_Footer_Compatibility extends WP_UnitTestCase {
    public function test_replaces_only_obsolete_legal_footer_labels(): void {
        $html = '<p>Chamber of Commerce KVK: 84216352</p>'
            . '<p>© 2023 Calorie Token</p>'
            . '<p>Tokenomics content remains unchanged.</p>';

        $result = LegalFooterCompatibility::replace_legacy_footer_html($html);

        $this->assertStringContainsString('Operator: ICTHendrikse · KVK 73774693', $result);
        $this->assertStringContainsString(
            '© 2026 ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse',
            $result
        );
        $this->assertStringContainsString('Tokenomics content remains unchanged.', $result);
        $this->assertStringNotContainsString('84216352', $result);
    }

    public function test_leaves_unrelated_html_unchanged(): void {
        $html = '<main><h1>CalorieApp</h1><p>Nutrition Tracking</p></main>';

        $this->assertSame($html, LegalFooterCompatibility::replace_legacy_footer_html($html));
    }
}
