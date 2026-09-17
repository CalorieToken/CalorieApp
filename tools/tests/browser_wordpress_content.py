"""Content style against saved public CSS; all pages/data below are synthetic.

No WordPress/account/payment/API requests. Remote Chromium CI only.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'wordpress-plugins/calorietoken-heading-repair/assets'
FIXTURES = ROOT / 'tools/tests/fixtures/wordpress-content'
OUT = ROOT / 'ux-check-evidence/wordpress-content-browser'
OUT.mkdir(parents=True, exist_ok=True)
SCRIPT = (ASSETS / 'content-style.js').read_text()
CSS = (ASSETS / 'content-style.css').read_text()
BASELINE = '\n'.join(p.read_text() for p in sorted(FIXTURES.glob('*.css'))) + '\n' + (ASSETS / 'app-focus.css').read_text()
report = {'mode': 'Synthetic public-page fixtures with captured live CSS; no live mutations', 'checks': [], 'errors': []}

def ok(name, condition=True):
    assert condition, name
    report['checks'].append(name)

BODY = '''
<header id="historic-header" class="ctstyle-site-header"><strong>CalorieToken</strong><p>Historical header</p><button>Account</button><div id="header-widget-region" class="ctstyle-header">
<nav id="brizy-menu" class="brz-menu-simple"><ul class="ctstyle-menu-groups"><li><a id="menu-home" href="#home" aria-current="page">Home</a></li><li><details id="menu-project" class="ctstyle-menu-category"><summary>Project</summary><ul><li><a href="#tokenomics">Tokenomics</a></li></ul></details></li></ul></nav>
<section id="login-card" class="xl-card calorieapp-identity-card"><div class="xl-card-header"><div class="xl-card-wallet">rSYNTHETICaccountForLayoutOnly</div></div><div class="xl-card-body"><div class="xl-card-avatar"><a id="login-link" href="?xl-signin" aria-label="Aanmelden"><img alt="Original login artwork" width="44" height="44" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Cpath d='M8 8h10v10H8zM26 8h10v10H26zM8 26h10v10H8zM26 26h4v4h6v6H26z' fill='white'/%3E%3C/svg%3E"></a></div><div class="xl-card-nickname">Mijn vertrouwde nickname</div><div class="xl-card-balance"><strong>Saldo:</strong> 123 CAL</div><div class="xl-card-rank"><strong>Rang:</strong> 42</div><div class="xl-card-note">Aanmelden via CalorieApp</div></div><div id="ctstyle-account-app"><a class="ctstyle-discovery-action" href="#app">Open CalorieApp</a><label class="ctstyle-widget-language" for="ctstyle-account-language">Taal</label><select id="ctstyle-account-language"><option value="nl" selected>Nederlands</option><option value="en">English</option></select></div><div class="calorieapp-site-session-actions"><button id="logout-button" class="calorieapp-site-logout" type="button">Uitloggen</button></div></section>
</div></header>
<div id="historic-title" class="ctstyle-title"><h1>CalorieApp</h1></div>
<main>
<aside class="calorieapp-page-market"><div class="calorieapp-xpmarket-widget ctstyle-market-card" data-state="ready">
<a class="calorieapp-xpmarket-link" href="https://xpmarket.com/fixture">
<div class="calorieapp-xpmarket-heading"><img class="calorieapp-xpmarket-logo" alt="CAL" width="48" height="48" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Ccircle cx='24' cy='24' r='22' fill='%23505ba9'/%3E%3C/svg%3E"><span class="calorieapp-xpmarket-title"><strong>Calorie Token</strong><small>CAL · XPMarket</small></span><span class="calorieapp-xpmarket-state">XPMarket-gegevens</span></div>
<div class="calorieapp-xpmarket-prices"><strong class="calorieapp-xpmarket-price">$0.0000002244</strong><small class="calorieapp-xpmarket-xrp">0.0000001735 XRP</small></div>
<div class="calorieapp-xpmarket-stats"><span><small>Marktkapitalisatie</small><strong>$13,4K</strong></span><span><small>Rang</small><strong>#207</strong></span><span><small>Houders</small><strong>14,5K</strong></span></div>
<span class="calorieapp-xpmarket-cta">Bekijk CAL op XPMarket <span>→</span></span></a></div></aside>
<div class="ctstyle-app-ending"><section id="app-card" class="calorieapp-app-info ctstyle-shared-panel">
<h2 class="ctstyle-section-heading ctstyle-word-heading"><span>CalorieApp</span></h2>
<p>Zoek voedingsproducten, bekijk voedingswaarden en houd je eigen eetdagboek bij.</p>
<p>CalorieApp staat hierboven op deze pagina.</p>
<p>Productgegevens van <a href="https://example.test/off">Open Food Facts</a> en <a href="https://example.test/usda">USDA FoodData Central</a>.</p>
<a class="ctstyle-discovery-action" href="/calorieapp/">Open CalorieApp</a></section></div>
<section class="ctstyle-discovery-card ctstyle-shared-panel" id="interaction-card"><h2>Accounthulp</h2><details id="faq"><summary>Hoe bewaar ik mijn herstelcode?</summary><p>Bewaar je code veilig en deel hem niet.</p></details><button id="ordinary-button" type="button">Volgende</button><button id="disabled-button" disabled>Niet beschikbaar</button><form id="synthetic-form"><label>E-mail <input type="email" value="synthetic@example.test"></label></form></section>
<div class="protected-art"><div id="historic-image" class="brz-image"><a href="/restaurants/"><img width="210" height="100" alt="Historic usecase illustration" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='210' height='100'%3E%3Crect width='210' height='100' fill='%23f9b233'/%3E%3C/svg%3E"></a></div></div>
<div id="historic-slider" class="brz-carousel"><p>Historical moving text</p><button id="slider-button">Next slide</button></div>
<div id="historic-animation" class="brz-animated"><p>Original Home animation</p></div>
<div id="native-account" class="xl-card"><p>Original account widget</p><button>Log out</button></div>
<div id="native-app" data-calorieapp-embed><p>Original app surface</p></div>
<section id="family-fixture"></section>
</main><footer id="historic-footer" class="ctstyle-footer"><p>Calorie aims to be the world's food token</p><button id="social-button">Next social</button></footer>
<aside id="after-footer"><p>Outside the content region</p></aside>
<aside id="ctstyle-app-launcher" class="ctstyle-app-launcher"><details id="help-disclosure"><summary id="help-toggle" aria-label="CalorieHelp openen of sluiten"><span id="help-mascot" class="ctstyle-help-mascot">Mascot</span></summary><div class="ctstyle-app-launcher-panel"><section class="ctstyle-help-widget"><header class="ctstyle-help-header"><h2>CalorieHelp</h2></header><p>Waar kan ik je mee helpen?</p><form class="ctstyle-help-form"><label for="help-question">Je vraag</label><input id="help-question" value=""><button type="button" id="help-ask">Vraag stellen</button></form><div class="ctstyle-help-reply" hidden><h3>Account instellen</h3><p>Open Accountbeheer in CalorieApp om je stappenplan te volgen.</p></div><h3>Onderwerpen</h3><div class="ctstyle-help-topics"><button type="button" id="help-topic" aria-pressed="false">Testaccount</button><button type="button">Voeding zoeken</button></div></section></div></details></aside>
'''
FAMILIES = {
 'legal-and-whitepaper': '<article class="ctstyle-document-copy ctstyle-shared-panel"><h2>Privacy Policy</h2><p>Document text with <a href="/terms-conditions/">terms</a>.</p></article>',
 'voting-hub': '<section class="ctstyle-community-status"><h2>Community Voting Hub</h2><p>Current public project information.</p><section class="ctstyle-shared-panel ctstyle-shared-panel-nested"><p>Historical context</p></section></section>',
 'showcases': '<div id="calorie-showcase-page"><section class="showcase-card ctstyle-shared-panel"><h3>Find a product</h3><p>Explore CalorieApp.</p><a class="showcase-action showcase-secondary" href="/calorieapp/">Open</a></section></div>',
 'tokenomics': '<section class="calorieapp-tokenomics-note ctstyle-shared-panel"><h2>Tokenomics</h2><p>Original chart remains above this explanatory card.</p></section>',
 'usecases': '<section class="ctstyle-usecase-content"><div class="calorieapp-context-note ctstyle-shared-panel"><p>Historical usecase concept.</p></div></section>',
 'blog-list-and-article': '<section class="calorieapp-article-copy ctstyle-shared-panel"><h2>About this article</h2><p>Original article content.</p></section><div class="ctstyle-blog-card ctstyle-shared-panel"><h2>Article link</h2><p>Excerpt</p></div>',
 'shop-cart-checkout': '<form class="woocommerce-checkout"><h2>Checkout</h2><p><label>Name <input value="Synthetic customer"></label></p><button disabled>Place order</button></form><div class="cart-collaterals"><section class="cart_totals"><h2>Cart totals</h2><p>No transaction is sent.</p></section></div>',
 'donations': '<section class="ctstyle-donation-balance"><h2>Donations</h2><p>Public balance</p><button type="button">View information</button></section>',
 'roadmap': '<section class="cal-road-intro"><h2>Roadmap</h2><p>Project plans</p></section><div class="ctstyle-roadmap-timeline"><section class="brz-timeline__tab"><h2>Next phase</h2><p>More information</p></section></div>',
 'faq': '<section class="ctstyle-faq-hub ctstyle-discovery-card ctstyle-shared-panel"><h2>Veelgestelde vragen</h2><p>Kies een vraag.</p><details class="ctstyle-faq-item"><summary>Hoe gebruik ik CalorieApp?</summary><p>Open de app en kies je stappenplan.</p></details></section>',
 'cal-crypto-and-trustline': '<section class="ctstyle-exchange-layout"><div class="cal-buy-risk ctstyle-shared-panel"><h2>Information</h2><p>Original risk notice.</p></div></section>',
 'richlist': '<div class="calorieapp-richlist-scroll"><table class="xl-richlist"><thead><tr><th>Rank</th><th>Account</th></tr></thead><tbody><tr class="xl-is-user"><td>123</td><td><a href="/example/">Synthetic account</a></td></tr></tbody></table></div>',
 'contact': '<section class="calorieapp-contact-card ctstyle-shared-panel"><h2>Contact</h2><p>Team information</p><a class="button" href="mailto:example@example.test">Contact</a></section>',
}

def html():
    return '<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@layer calorietoken-content;</style><style>' + BASELINE + '''
    body{margin:0;background:#f5f5f8 repeating-linear-gradient(45deg,transparent 0 20px,#505ba906 20px 22px)}main{max-width:1040px;margin:24px auto;padding:0 14px}button{cursor:pointer}
    #historic-header{padding:24px;background:#f9b233;font:20px Georgia}
    #historic-title{margin:28px auto;padding:24px;max-width:720px;background:#dfe0ed;border-radius:28px;font:24px Georgia;text-align:center}
    #header-widget-region{max-width:400px;margin:auto}#historic-title h1{margin:0}#historic-footer{padding:24px;background:#505ba9;color:white;font:18px Georgia}
    #interaction-card,#family-fixture{max-width:800px;margin:24px auto}.protected-art,.brz-carousel,.brz-animated,.xl-card,[data-calorieapp-embed]{margin:20px auto;padding:18px;max-width:400px;font:18px Georgia;background:#e9e9f3}
    #ctstyle-app-launcher{margin:20px auto;max-width:380px;padding:8px;box-sizing:border-box}.ctstyle-app-launcher-panel{box-sizing:border-box;padding:16px}.ctstyle-help-form{display:grid;gap:10px}.ctstyle-help-form input{min-width:0;width:100%}
    </style><body class="ctstyle-enabled ct-account-compact page-id-1090">''' + BODY + '''<script>
    window.fixtureClicks={ordinary:0,slider:0,social:0};window.fixtureAccountClicks={login:0,logout:0};
    document.getElementById('login-link').onclick=e=>{e.preventDefault();window.fixtureAccountClicks.login++};
    document.getElementById('logout-button').onclick=()=>window.fixtureAccountClicks.logout++;
    document.getElementById('ordinary-button').onclick=()=>window.fixtureClicks.ordinary++;
    document.getElementById('slider-button').onclick=()=>window.fixtureClicks.slider++;
    document.getElementById('social-button').onclick=()=>window.fixtureClicks.social++;
    document.getElementById('synthetic-form').onsubmit=e=>e.preventDefault();
    document.getElementById('help-topic').onclick=()=>{document.querySelector('.ctstyle-help-reply').hidden=false;document.getElementById('help-topic').setAttribute('aria-pressed','true')};
    </script></body></html>'''

protected = ['historic-header','historic-title','historic-footer','historic-image','historic-slider','historic-animation','native-account','native-app','after-footer','help-mascot']
def protected_snapshot(page):
    return page.evaluate('''ids => Object.fromEntries(ids.map(id=>{
        const n=document.getElementById(id),clone=n.cloneNode(true);
        [clone,...clone.querySelectorAll('*')].forEach(x=>{if(x.hasAttribute('class'))x.setAttribute('class',x.className.split(/\\s+/).filter(c=>!c.startsWith('ct-content-')).join(' '))});
        const unchanged=[n,...n.querySelectorAll('*')].filter(x=>!x.closest('.xl-card')&&!(x.closest('.brz-menu-simple')&&x.closest('a,button,summary,label')));
        return [id,{html:clone.outerHTML,style:unchanged.map(x=>{const s=getComputedStyle(x);return [s.fontFamily,s.fontSize,s.color,s.backgroundColor,s.backgroundImage,s.backgroundSize,s.borderRadius,s.borderWidth,s.padding,s.transform,s.animationName,s.display]})}]
    }))''', protected)

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':360,'height':900}, service_workers='block')
    context.route('**/*', lambda route: route.fulfill(status=200,content_type='text/html',body=html()) if route.request.url=='https://calorietoken.net/style-fixture/' else route.abort())
    page = context.new_page()
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    try:
        page.goto('https://calorietoken.net/style-fixture/', wait_until='domcontentloaded')
        before=protected_snapshot(page)
        background=page.locator('body').evaluate('n=>[getComputedStyle(n).backgroundImage,getComputedStyle(n).backgroundColor]')
        page.locator('main').screenshot(path=str(OUT/'before-content-360.png'))
        page.add_style_tag(content=CSS)
        page.add_script_tag(content=SCRIPT)
        page.wait_for_function("document.querySelector('#app-card').classList.contains('ct-content-card')")
        ok('Historical header, title, footer, artwork, sliders, animation and native app are preserved',before==protected_snapshot(page))
        ok('Page background image and color are preserved',background==page.locator('body').evaluate('n=>[getComputedStyle(n).backgroundImage,getComputedStyle(n).backgroundColor]'))
        ok('App card overrides the installed serif typography', 'Segoe UI' in page.locator('#app-card p').first.evaluate('(n)=>getComputedStyle(n).fontFamily'))
        ok('App card is white with a thin border',page.locator('#app-card').evaluate("n=>getComputedStyle(n).backgroundColor==='rgb(255, 255, 255)' && getComputedStyle(n).borderLeftWidth==='1px'"))
        ok('App heading uses native green sans-serif',page.locator('#app-card h2').evaluate("n=>getComputedStyle(n).color==='rgb(0, 141, 54)' && getComputedStyle(n).fontFamily.includes('Segoe UI')"))
        page.locator('#ordinary-button').click();page.locator('#slider-button').click();page.locator('#social-button').click()
        ok('Original content and carousel click handlers still fire',page.evaluate('window.fixtureClicks')=={'ordinary':1,'slider':1,'social':1})
        page.locator('#faq summary').click();ok('FAQ disclosure still opens',page.locator('#faq').evaluate('n=>n.open'))
        ok('Disabled action and input value survive styling',page.locator('#disabled-button').is_disabled() and page.locator('#synthetic-form input').input_value()=='synthetic@example.test')
        ok('CalorieHelp adopts the same typography outside the main page flow',page.locator('.ctstyle-help-widget h2').evaluate("n=>getComputedStyle(n).fontFamily.includes('Segoe UI') && getComputedStyle(n).color==='rgb(0, 141, 54)'"))
        page.locator('#help-toggle').click()
        ok('CalorieHelp opens through its original disclosure',page.locator('.ctstyle-app-launcher-panel').is_visible())
        page.locator('#help-topic').click()
        ok('Help topics still reveal their answer',page.locator('.ctstyle-help-reply').is_visible())
        ok('Selected help topic stays visually distinct',page.locator('#help-topic').evaluate("n=>getComputedStyle(n).backgroundColor==='rgb(80, 91, 169)'"))
        page.locator('.ctstyle-app-launcher-panel').screenshot(path=str(OUT/'caloriehelp-360.png'))
        page.locator('#help-toggle').click()
        ok('CalorieHelp closes before reviewing the page content',not page.locator('.ctstyle-app-launcher-panel').is_visible())
        ok('Login widget is white with a green upper edge',page.locator('#login-card').evaluate("n=>getComputedStyle(n).backgroundColor==='rgb(255, 255, 255)' && getComputedStyle(n).borderTopColor==='rgb(0, 141, 54)'"))
        ok('Login nickname uses app typography',page.locator('.xl-card-nickname').evaluate("n=>getComputedStyle(n).fontFamily.includes('Segoe UI')"))
        ok('Original wallet, nickname and language are retained',page.locator('.xl-card-wallet').inner_text()=='rSYNTHETICaccountForLayoutOnly' and page.locator('.xl-card-nickname').inner_text()=='Mijn vertrouwde nickname' and page.locator('#ctstyle-account-language').input_value()=='nl')
        page.locator('#login-link').click();page.locator('#logout-button').click()
        ok('Existing login/logout handlers remain attached',page.evaluate('window.fixtureAccountClicks')=={'login':1,'logout':1})
        ok('Brizy menu keeps its current-page destination',page.locator('#menu-home').get_attribute('href')=='#home' and page.locator('#menu-home').get_attribute('aria-current')=='page')
        ok('Brizy current-page button uses the app active color',page.locator('#menu-home').evaluate("n=>getComputedStyle(n).backgroundColor==='rgb(0, 141, 54)'"))
        page.locator('#menu-project>summary').click()
        ok('Original menu disclosure still opens',page.locator('#menu-project').evaluate('n=>n.open') and page.locator('#menu-project a').is_visible())
        page.locator('#menu-project>summary').click()
        ok('Original menu disclosure still closes',not page.locator('#menu-project a').is_visible())
        for width in [360,412,1440]:
            page.set_viewport_size({'width':width,'height':900})
            ok(f'{width}px content has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'))
            rows=page.locator('.calorieapp-xpmarket-stats>span').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().y)')
            ok(f'{width}px XPMarket stats use readable rows/columns',rows[1]>rows[0] if width<601 else rows[1]==rows[0])
            ok(f'{width}px market labels fit',page.locator('.calorieapp-xpmarket-stats small').evaluate_all('(nodes)=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)'))
            ok(f'{width}px normal action has a touch-sized target',page.locator('#ordinary-button').bounding_box()['height']>=44)
            ok(f'{width}px login widget has no horizontal clipping',page.locator('#login-card').evaluate('n=>n.scrollWidth<=n.clientWidth'))
            ok(f'{width}px menu buttons stay inside the menu',page.locator('#brizy-menu').evaluate('n=>n.scrollWidth<=n.clientWidth'))
            page.locator('#login-card').screenshot(path=str(OUT/f'login-widget-{width}.png'))
            page.locator('#brizy-menu').screenshot(path=str(OUT/f'menu-buttons-{width}.png'))
            page.locator('.ctstyle-app-ending').screenshot(path=str(OUT/f'app-card-{width}.png'))
            page.locator('.calorieapp-page-market').screenshot(path=str(OUT/f'market-{width}.png'))
        page.set_viewport_size({'width':360,'height':900})
        page.locator('#login-card').evaluate("n=>{n.classList.add('xl-no-wallet');n.querySelector('#logout-button').hidden=true}")
        ok('Existing guest visibility rules are preserved',not page.locator('#logout-button').is_visible() and not page.locator('#login-card .xl-card-header').is_visible() and not page.locator('#login-card .xl-card-balance').is_visible())
        ok('Original login artwork remains visible on its purple surface',page.locator('#login-link img').is_visible() and page.locator('#login-link').evaluate("n=>getComputedStyle(n).backgroundColor==='rgb(80, 91, 169)'"))
        page.locator('#login-card').screenshot(path=str(OUT/'login-widget-guest-360.png'))
        for family, markup in FAMILIES.items():
            page.locator('#family-fixture').evaluate('(n,markup)=>n.innerHTML=markup',markup)
            page.wait_for_function("document.querySelector('#family-fixture .ct-content-text,#family-fixture .ct-content-table')!==null")
            ok(f'{family}: late-loaded content receives app typography')
            for width in [360,412,1440]:
                page.set_viewport_size({'width':width,'height':900})
                ok(f'{family} {width}px: content stays within the viewport',page.locator('#family-fixture').evaluate('(n)=>n.scrollWidth<=n.clientWidth'))
            if family=='faq':
                page.set_viewport_size({'width':360,'height':900})
                page.locator('.ctstyle-faq-item summary').click()
                ok('FAQ page questions retain their disclosure behavior',page.locator('.ctstyle-faq-item').evaluate('n=>n.open'))
                page.locator('#family-fixture').screenshot(path=str(OUT/'faq-360.png'))
        for lang in ['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur']:
            page.set_viewport_size({'width':360,'height':900})
            page.evaluate("lang=>{document.documentElement.lang=lang;document.querySelector('main').dir=['ar','ur'].includes(lang)?'rtl':'ltr';}",lang)
            ok(f'{lang}: direction and layout remain usable',page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'))
        # Actual long RTL copy checks, beyond the direction-only locale pass.
        page.locator('#app-card p').first.evaluate("n=>n.textContent='ابحث عن المنتجات الغذائية وتعرّف على قيمتها الغذائية واحتفظ بمذكراتك الغذائية الخاصة.'")
        page.locator('.ctstyle-app-ending').screenshot(path=str(OUT/'app-card-rtl-360.png'))
        ok('RTL copy does not overflow',page.locator('#app-card').evaluate('(n)=>n.scrollWidth<=n.clientWidth'))
        page.evaluate("document.querySelector('main').dir='ltr'")
        page.locator('#family-fixture').evaluate("n=>n.innerHTML='<section id=late class=ctstyle-shared-panel><h2>Late card</h2><p>Dynamic copy</p></section>'")
        page.wait_for_function("document.querySelector('#late').classList.contains('ct-content-card')")
        page.evaluate("document.querySelector('#historic-header').append(document.querySelector('#late'))")
        page.wait_for_function("!document.querySelector('#late').classList.contains('ct-content-card')")
        ok('A node moved outside the content region loses its content markers')
        ok('No runtime errors',not report['errors'])
        report['status']='passed'
    except Exception as error:
        report['status']='failed';report['failure']=str(error)
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        browser.close()
print(json.dumps({'status':report['status'],'checks':len(report['checks'])}))
