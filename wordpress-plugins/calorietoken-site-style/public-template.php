<?php
if (!defined('ABSPATH')) { exit; }
?><!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
<body <?php body_class('ctstyle-public-document'); ?>>
<?php if (function_exists('wp_body_open')) { wp_body_open(); } ?>
<a class="screen-reader-text" href="#main-content">Skip to content</a>
<main id="main-content" class="ctstyle-public-main">
<?php while (have_posts()) : the_post(); ?>
<article class="ctstyle-document entry-content">
<h1 class="entry-title"><?php the_title(); ?></h1>
<div class="ctstyle-document-copy"><?php
    $content = get_the_content();
    // The theme previously added a second H1 around these two exact CMS titles.
    if (is_page(array(531,586))) {
        $content = preg_replace('/<h1\b[^>]*>\s*(?:Privacy Policy|Terms\s*(?:&amp;|&)\s*Conditions)\s*<\/h1>/i', '', $content, 1);
    }
    $content = apply_filters('the_content', $content);
    echo $content;
?></div>
</article>
<?php if (\CalorieToken\SiteStyle\PublicPages::is_hub() &&
    strpos($content, 'data-calorieapp-xpmarket-widget') === false &&
    strpos($content, 'livecoinwatch-widget-1') === false) : ?>
<aside class="calorieapp-page-market ctstyle-hub-market" aria-label="Calorie Token on XPMarket">
  <div data-calorieapp-xpmarket-widget=""><a href="https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY" rel="noopener noreferrer">View CAL on XPMarket</a></div>
</aside>
<?php endif; ?>
<?php endwhile; ?>
</main>
<?php wp_footer(); ?>
</body></html>
