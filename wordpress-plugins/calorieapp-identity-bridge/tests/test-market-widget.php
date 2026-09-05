<?php

use CalorieApp\IdentityBridge\MarketWidget;

class Test_CalorieApp_Market_Widget extends WP_UnitTestCase {
    private const CACHE_KEY = 'calorieapp_xpmarket_widget_v1';

    public function tearDown(): void {
        delete_transient(self::CACHE_KEY);
        parent::tearDown();
    }

    public function test_valid_xpmarket_payload_is_reduced_to_public_cal_fields(): void {
        $data = MarketWidget::sanitize_payload($this->valid_payload());

        $this->assertIsArray($data);
        $this->assertSame('XPMarket', $data['source']);
        $this->assertSame('Calorie', $data['code']);
        $this->assertSame('Calorie Token', $data['title']);
        $this->assertSame('rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY', $data['issuer']);
        $this->assertSame(0.0000000514095, $data['price_xrp']);
        $this->assertSame(0.000000072292, $data['price_usd']);
        $this->assertSame(4308.59, $data['market_cap_usd']);
        $this->assertSame(14511, $data['holders']);
        $this->assertSame(307, $data['rank']);
        $this->assertArrayNotHasKey('circulating', $data);
        $this->assertArrayNotHasKey('total', $data);
    }

    public function test_payload_validation_rejects_a_different_token_or_logo_host(): void {
        $wrong_issuer = $this->valid_payload();
        $wrong_issuer['data']['issuer'] = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
        $this->assertNull(MarketWidget::sanitize_payload($wrong_issuer));

        $wrong_logo = $this->valid_payload();
        $wrong_logo['data']['logo'] = 'https://example.test/calorie.webp';
        $this->assertNull(MarketWidget::sanitize_payload($wrong_logo));
    }

    public function test_payload_validation_rejects_missing_or_negative_numbers(): void {
        $missing_price = $this->valid_payload();
        unset($missing_price['data']['priceUsd']);
        $this->assertNull(MarketWidget::sanitize_payload($missing_price));

        $negative_rank = $this->valid_payload();
        $negative_rank['data']['rank'] = -1;
        $this->assertNull(MarketWidget::sanitize_payload($negative_rank));
    }

    public function test_cached_public_payload_is_returned_without_an_upstream_request(): void {
        $cached = MarketWidget::sanitize_payload($this->valid_payload());
        set_transient(self::CACHE_KEY, $cached, 300);

        $response = (new MarketWidget())->get_widget();

        $this->assertInstanceOf(WP_REST_Response::class, $response);
        $this->assertSame(200, $response->get_status());
        $this->assertSame($cached, $response->get_data()['data']);
        $this->assertSame('public, max-age=300', $response->get_headers()['Cache-Control']);
    }

    private function valid_payload(): array {
        return [
            'success' => true,
            'data' => [
                'code' => 'Calorie',
                'issuer' => 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY',
                'title' => 'Calorie Token',
                'logo' => 'https://xpcdn.xpmarket.com/storage/logo/calorie.webp',
                'price' => 0.0000000514095,
                'priceUsd' => 0.000000072292,
                'marketcap' => 4308.59,
                'holders' => 14511,
                'rank' => 307,
                'circulating' => '59601847344',
                'total' => '99184536783',
            ],
        ];
    }
}
