<?php
if (!defined('ABSPATH')) { exit; }
?>
<template id="ctstyle-tools-template">
<span hidden data-ctstyle-site-integration data-home-page="<?php echo esc_url(home_url('/')); ?>" data-app-page="<?php echo esc_url(home_url('/index.php/calorieapp/')); ?>" data-app-logo="<?php echo esc_url(plugin_dir_url(__FILE__) . 'assets/calorieapp-logo.svg'); ?>" data-is-home="0"></span>
<nav class="calorieapp-page-tools" data-calorieapp-fallback-shortcuts aria-label="Page shortcuts" hidden>
  <div class="calorieapp-page-tool-position calorieapp-page-tool-position-home" data-calorieapp-shortcut="home" hidden>
    <a class="calorieapp-page-tool" href="<?php echo esc_url(home_url('/')); ?>" aria-label="Go to Home"><svg class="calorieapp-page-tool-icon" aria-hidden="true" focusable="false"><use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/glyph/home-minimal.svg#nc_icon')); ?>"></use></svg></a>
  </div>
  <div class="calorieapp-page-tool-position calorieapp-page-tool-position-app" data-calorieapp-shortcut="app" hidden>
    <a class="calorieapp-page-tool" href="<?php echo esc_url(home_url('/index.php/calorieapp/')); ?>" aria-label="Open CalorieApp"><img class="calorieapp-page-tool-icon" src="<?php echo esc_url(plugin_dir_url(__FILE__) . 'assets/calorieapp-logo.svg'); ?>" width="48" height="48" alt="" aria-hidden="true"></a>
  </div>
  <div class="calorieapp-page-tool-position calorieapp-page-tool-position-bottom" data-calorieapp-shortcut="bottom" hidden>
    <a class="calorieapp-page-tool" href="#" data-calorieapp-scroll="bottom" aria-label="Go to bottom"><svg class="calorieapp-page-tool-icon" aria-hidden="true" focusable="false"><use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/glyph/square-download.svg#nc_icon')); ?>"></use></svg></a>
  </div>
  <div class="calorieapp-page-tool-position calorieapp-page-tool-position-top" data-calorieapp-shortcut="top" hidden>
    <a class="calorieapp-page-tool" href="#" data-calorieapp-scroll="top" aria-label="Back to top"><svg class="calorieapp-page-tool-icon" aria-hidden="true" focusable="false"><use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/glyph/square-upload.svg#nc_icon')); ?>"></use></svg></a>
  </div>
</nav>
</template>
<template id="ctstyle-footer-template">
<footer class="ctstyle-footer">
                <nav class="ctstyle-socials" aria-label="CalorieToken social channels"  >
                    <button type="button" class="ctstyle-social-arrow" data-ctstyle-direction="-1" aria-label="Previous social channel">‹</button>
                    <div class="ctstyle-social-window">
                        <div class="ctstyle-social-track">
                                                            <a class="ctstyle-social" href="https://t.me/+7YxaKdQYWNA0NDA0" rel="noopener" aria-label="Telegram" title="Telegram">
                                    <svg class="ctstyle-social-icon" aria-hidden="true" focusable="false">
                                        <use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/fa/telegram.svg#fa_icon')); ?>"></use>
                                    </svg>
                                </a>
                                                            <a class="ctstyle-social" href="https://github.com/CalorieToken" rel="noopener" aria-label="GitHub" title="GitHub">
                                    <svg class="ctstyle-social-icon" aria-hidden="true" focusable="false">
                                        <use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/fa/github-square.svg#fa_icon')); ?>"></use>
                                    </svg>
                                </a>
                                                            <a class="ctstyle-social" href="https://x.com/CalorieToken" rel="noopener" aria-label="CalorieToken on X" title="CalorieToken on X">
                                    <svg class="ctstyle-social-icon" aria-hidden="true" focusable="false" viewBox="0 0 1200 1227"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" fill="currentColor"></path></svg>
                                </a>
                                                            <a class="ctstyle-social" href="https://www.facebook.com/CalorieToken-100422882407878" rel="noopener" aria-label="Facebook" title="Facebook">
                                    <svg class="ctstyle-social-icon" aria-hidden="true" focusable="false">
                                        <use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/fa/facebook.svg#fa_icon')); ?>"></use>
                                    </svg>
                                </a>
                                                            <a class="ctstyle-social" href="https://www.youtube.com/channel/UCV_87rxST-cQOVu4W8nFZkA" rel="noopener" aria-label="YouTube" title="YouTube">
                                    <svg class="ctstyle-social-icon" aria-hidden="true" focusable="false">
                                        <use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/fa/youtube.svg#fa_icon')); ?>"></use>
                                    </svg>
                                </a>
                                                            <a class="ctstyle-social" href="https://www.linkedin.com/company/calorie-token/" rel="noopener" aria-label="LinkedIn" title="LinkedIn">
                                    <svg class="ctstyle-social-icon" aria-hidden="true" focusable="false">
                                        <use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/fa/linkedin.svg#fa_icon')); ?>"></use>
                                    </svg>
                                </a>
                                                            <a class="ctstyle-social" href="https://www.instagram.com/calorietoken/" rel="noopener" aria-label="Instagram" title="Instagram">
                                    <svg class="ctstyle-social-icon" aria-hidden="true" focusable="false">
                                        <use href="<?php echo esc_url(content_url('/plugins/brizy/public/editor-build/prod/editor/icons/fa/instagram-square.svg#fa_icon')); ?>"></use>
                                    </svg>
                                </a>
                                                    </div>
                    </div>
                    <button type="button" class="ctstyle-social-arrow" data-ctstyle-direction="1" aria-label="Next social channel">›</button>
                </nav>
                <div class="ctstyle-legal">
                    <p>Calorie aims to be the world’s food token</p>
                    <p>Operator: ICTHendrikse · KVK 73774693</p>
                    <p>
                        © <?php echo esc_html(wp_date('Y')); ?> ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse                    </p>
                    <p class="ctstyle-legal-links">
                        <a href="<?php echo esc_url(home_url('/index.php/privacy-policy/')); ?>">Privacy Policy</a>
                        <a href="<?php echo esc_url(home_url('/index.php/terms-conditions/')); ?>">Terms &amp; Conditions</a>
                        <?php $ctstyle_hub_id = (int) get_option('ctstyle_public_hub_id', 0); ?>
                        <?php if ($ctstyle_hub_id && get_post_status($ctstyle_hub_id) === 'publish' && get_post_meta($ctstyle_hub_id, '_ctstyle_public_hub', true) === '1') : ?>
                        <a href="<?php echo esc_url(get_permalink($ctstyle_hub_id)); ?>">Community Voting Hub</a>
                        <?php endif; ?>
                    </p>
                </div>
            </footer>
</template>
<?php if (!\CalorieToken\SiteStyle\Plugin::footer_only()) : ?>
<?php $ctstyle_header_menu = \CalorieToken\SiteStyle\Plugin::header_menu(); ?>
<template id="ctstyle-header-template"><header class="ctstyle-header ctstyle-header-fallback"><div class="ctstyle-header-inner"><div class="ctstyle-header-brand"><a class="ctstyle-logo" href="<?php echo esc_url(home_url('/')); ?>" aria-label="CalorieToken home"><img src="<?php echo esc_url(content_url('/uploads/2021/12/C-Logotranspa-1024x936.png')); ?>" width="173" height="158" alt="CalorieToken"></a><nav class="ctstyle-header-nav ctstyle-desktop-nav" aria-label="Main navigation"><?php if ($ctstyle_header_menu !== '') { echo $ctstyle_header_menu; } else { ?><ul><li><a href="<?php echo esc_url(home_url('/')); ?>">Home</a></li><li><a href="<?php echo esc_url(home_url('/index.php/whitepaper/')); ?>">Whitepaper</a></li><li><a href="<?php echo esc_url(home_url('/index.php/how-to-buy-calorie/')); ?>">How to buy</a></li><li><a href="<?php echo esc_url(home_url('/index.php/trustline/')); ?>">Trustline</a></li><li><a href="<?php echo esc_url(home_url('/index.php/tokenomics-update/')); ?>">Tokenomics update</a></li><li><a href="<?php echo esc_url(home_url('/index.php/roadmap/')); ?>">Roadmap</a></li><li><a href="<?php echo esc_url(home_url('/index.php/richlist/')); ?>">Richlist</a></li><li><a href="<?php echo esc_url(home_url('/index.php/blog/')); ?>">Blog</a></li><li><a href="<?php echo esc_url(home_url('/index.php/contact/')); ?>">Contact</a></li><li><a href="<?php echo esc_url(home_url('/index.php/faq/')); ?>">FAQ</a></li><li><a href="<?php echo esc_url(home_url('/index.php/donate/')); ?>">Donate</a></li><li><a href="<?php echo esc_url(home_url('/index.php/merchnfts/')); ?>">Merch&amp;NFTs</a></li></ul><?php } ?></nav><details class="ctstyle-header-nav ctstyle-mobile-nav"><summary>Menu</summary><nav aria-label="Main navigation"><?php if ($ctstyle_header_menu !== '') { echo $ctstyle_header_menu; } else { ?><ul><li><a href="<?php echo esc_url(home_url('/')); ?>">Home</a></li><li><a href="<?php echo esc_url(home_url('/index.php/whitepaper/')); ?>">Whitepaper</a></li><li><a href="<?php echo esc_url(home_url('/index.php/how-to-buy-calorie/')); ?>">How to buy</a></li><li><a href="<?php echo esc_url(home_url('/index.php/trustline/')); ?>">Trustline</a></li><li><a href="<?php echo esc_url(home_url('/index.php/tokenomics-update/')); ?>">Tokenomics update</a></li><li><a href="<?php echo esc_url(home_url('/index.php/roadmap/')); ?>">Roadmap</a></li><li><a href="<?php echo esc_url(home_url('/index.php/richlist/')); ?>">Richlist</a></li><li><a href="<?php echo esc_url(home_url('/index.php/blog/')); ?>">Blog</a></li><li><a href="<?php echo esc_url(home_url('/index.php/contact/')); ?>">Contact</a></li><li><a href="<?php echo esc_url(home_url('/index.php/faq/')); ?>">FAQ</a></li><li><a href="<?php echo esc_url(home_url('/index.php/donate/')); ?>">Donate</a></li><li><a href="<?php echo esc_url(home_url('/index.php/merchnfts/')); ?>">Merch&amp;NFTs</a></li></ul><?php } ?></nav></details></div><div class="ctstyle-header-account" hidden></div></div></header></template>

<?php if ((is_page(array(1119,1121,1123,1125,1127,1129)) || \CalorieToken\SiteStyle\PublicPages::is_document()) && function_exists('shortcode_exists') && shortcode_exists('xummuser')) : ?>
<div id="ctstyle-native-account-source" hidden><?php echo do_shortcode('[xummuser return="card" trade="true"]'); ?></div>
<?php endif; ?>
<?php endif; ?>
