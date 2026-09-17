"""Native account guidance, embedded in a synthetic WordPress host.

Every request is intercepted. No real account, faucet, wallet, backend or
clipboard is used. Production-built app assets come only from localhost.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'ux-check-evidence' / 'account-guides-browser'
OUT.mkdir(parents=True, exist_ok=True)
T = json.loads((ROOT / 'frontend/config/testnet-entry-copy.json').read_text())
S = json.loads((ROOT / 'frontend/config/account-setup-copy.json').read_text())
PLUGIN = ROOT / 'wordpress-plugins/calorietoken-heading-repair/assets'
# Format-shaped strings with no valid checksum: cannot be used as credentials.
ADDRESS = 'r' + '1' * 25
SEED = 's' + '1' * 24
report = {'mode': 'Synthetic-only embedded native guides', 'checks': [], 'errors': [], 'faucet_requests': 0, 'unexpected_requests': []}
parent = '''<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:Georgia,serif;font-size:42px;background:#f5f5f5}button,h2{font-family:Georgia,serif;font-size:42px}iframe{display:block;width:100%;border:0;height:1500px}
''' + (PLUGIN / 'app-focus.css').read_text() + '''</style></head><body class="page-id-7880 ctstyle-enabled">
<div id="ctstyle-account-app"></div><div data-calorieapp-embed><iframe title="CalorieApp" src="https://app.calorietoken.net/?ui_lang=nl"></iframe></div>
<section id="ctstyle-testnet" data-ctstyle-testnet="1"><div class="ctstyle-test-steps">Old WordPress help fixture</div></section>
<script>window.CalorieTokenAgeExperience={getBand:()=> 'adult'};window.guideMessages=[];
window.addEventListener('message',event=>{if(event.origin!=='https://app.calorietoken.net')return;window.guideMessages.push(event.data);if(event.data.type==='calorieapp:frame:height'&&Number.isFinite(event.data.height))document.querySelector('iframe').style.height=event.data.height+'px';});</script>
<script>''' + (PLUGIN / 'app-focus.js').read_text() + '''</script></body></html>'''


def ok(name, condition=True):
    assert condition, name
    report['checks'].append(name)


def route_request(route):
    req = route.request
    u = urlsplit(req.url)
    assert SEED not in req.url and SEED not in (req.post_data or ''), 'Recovery data in outgoing request'
    if u.hostname == 'calorietoken.net':
        route.fulfill(status=200, content_type='text/html', body=parent)
    elif u.hostname == 'app.calorietoken.net':
        if u.path.startswith('/api/backend'):
            if req.method != 'GET':
                report['unexpected_requests'].append(req.method + ' ' + u.path)
            route.fulfill(status=401, content_type='application/json', body='{"detail":"Synthetic guest"}')
        else:
            response = route.fetch(url='http://127.0.0.1:3100' + u.path + ('?' + u.query if u.query else ''))
            route.fulfill(response=response)
    elif req.url == 'https://faucet.altnet.rippletest.net/accounts':
        assert req.method == 'POST' and not req.post_data, 'Faucet must be an empty explicit POST'
        report['faucet_requests'] += 1
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'account': {'address': ADDRESS}, 'seed': SEED}))
    else:
        report['unexpected_requests'].append(req.method + ' ' + u.hostname + u.path)
        route.abort()


def ledger(socket):
    assert socket.url == 'wss://s.altnet.rippletest.net:51233/', 'Only the Testnet ledger is permitted'
    def receive(message):
        request = json.loads(message)
        assert request == {'id': 1, 'command': 'account_info', 'account': ADDRESS, 'ledger_index': 'validated', 'strict': True}
        socket.send(json.dumps({'id': 1, 'status': 'success', 'result': {'validated': True, 'account_data': {'Account': ADDRESS, 'Balance': '100000000'}}}))
    socket.on_message(receive)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, **({'executable_path': os.environ['CALORIE_BROWSER_EXECUTABLE']} if os.environ.get('CALORIE_BROWSER_EXECUTABLE') else {}))
    context = browser.new_context(viewport={'width': 360, 'height': 900}, locale='nl-NL', service_workers='block', reduced_motion='reduce')
    context.route('**/*', route_request)
    context.route_web_socket('**/*', ledger)
    context.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}}});")
    page = context.new_page()
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    try:
        page.goto('https://calorietoken.net/calorieapp/', wait_until='networkidle')
        app = page.frame_locator('iframe[title="CalorieApp"]')
        app.locator('button[data-age-option="adult"]').click()
        app.get_by_role('button', name=T['nl']['testRoute'], exact=True).click()
        guide = app.locator('[data-account-guide]')
        title = guide.locator('#account-journey-title')
        def next_step(locale='nl'):
            guide.get_by_role('button', name=T[locale]['next'], exact=True).click()
        def previous(locale='nl'):
            guide.get_by_role('button', name=T[locale]['previous'], exact=True).click()
        def screen(name):
            expect(title).to_have_text(name)
            expect(guide.locator('[data-account-guide-screen]')).to_have_count(1)
            expect(page.locator('#ct-testnet-guide-layer')).to_be_hidden()
            expect(app.locator('.calorie-workspace-tabs')).to_be_hidden()
        screen(S['nl']['beforeStart'])
        ok('Opening account help stays inside the app; the WordPress guide stays closed')
        ok('No account is created by opening the guide', report['faucet_requests'] == 0)
        guide.screenshot(path=str(OUT / 'nl-test-start-360.png'))
        next_step(); screen(S['nl']['stepCreate'])
        expect(guide.get_by_role('button', name=T['nl']['next'], exact=True)).to_be_disabled()
        guide.get_by_role('button', name=S['nl']['create'], exact=True).dblclick()
        screen(S['nl']['saveTitle'])
        ok('Explicit double click produces exactly one synthetic faucet request', report['faucet_requests'] == 1)
        secret = guide.locator('#account-guide-secret')
        expect(secret).to_be_hidden(); expect(secret).to_have_text('')
        expect(guide.get_by_label(S['nl']['saveAck'], exact=True)).to_be_disabled()
        expect(guide.get_by_role('button', name=T['nl']['next'], exact=True)).to_be_disabled()
        ok('The secret starts concealed and the backup confirmation cannot be skipped')
        guide.get_by_role('button', name=S['nl']['show'], exact=True).click()
        expect(secret).to_have_text(SEED)
        expect(guide.get_by_role('button', name=T['nl']['next'], exact=True)).to_be_disabled()
        guide.get_by_role('button', name=S['nl']['copySeed'], exact=True).click()
        expect(guide.get_by_role('status')).to_have_text(S['nl']['copiedSafe'])
        guide.get_by_label(S['nl']['saveAck'], exact=True).check()
        next_step(); screen(S['nl']['stepNetwork'])
        expect(guide.locator('code')).to_have_count(0)
        previous(); screen(S['nl']['saveTitle']); expect(secret).to_be_hidden(); expect(secret).to_have_text('')
        guide.screenshot(path=str(OUT / 'nl-secret-backup-360.png'))
        previous(); screen(S['nl']['stepCreate'])
        expect(guide.get_by_role('button', name=S['nl']['create'], exact=True)).to_have_count(0)
        ok('Back navigation retains the same account and never offers duplicate creation', report['faucet_requests'] == 1)
        next_step(); next_step(); next_step(); screen(S['nl']['stepImport'])
        expect(guide.get_by_role('button', name=T['nl']['next'], exact=True)).to_be_disabled()
        guide.get_by_role('button', name=S['nl']['show'], exact=True).click()
        guide.get_by_role('button', name=S['nl']['backToAccount'], exact=True).click()
        expect(app.locator('#account-guide-secret')).to_have_count(0)
        app.get_by_role('button', name=T['nl']['returnGuide'], exact=True).click()
        screen(S['nl']['stepImport']); expect(secret).to_have_text('')
        guide.get_by_label(S['nl']['testImported'], exact=True).check()
        next_step(); screen(S['nl']['stepReturn'])
        expect(guide.get_by_role('status')).to_have_text(S['nl']['funded'])
        ok('Leaving the guide conceals the secret and returning preserves the exact page')
        guide.get_by_role('button', name=T['nl']['openSignIn'], exact=True).click()
        app.get_by_role('button', name=T['nl']['moveRoute'], exact=True).click()
        screen(T['nl']['moveLabels'][0]); expect(guide.get_by_text(T['nl']['importPending'], exact=True)).to_be_visible()
        guide.get_by_role('button', name=T['nl']['openExportTools'], exact=True).click()
        app.get_by_role('button', name=T['nl']['returnGuide'], exact=True).click()
        screen(T['nl']['moveLabels'][0]); next_step(); screen(T['nl']['moveLabels'][1]); next_step(); screen(T['nl']['moveLabels'][2]); next_step()
        screen(S['nl']['mainBackupTitle'])
        expect(guide.get_by_role('button', name=T['nl']['next'], exact=True)).to_be_disabled()
        expect(guide.locator('input:not([type="checkbox"])')).to_have_count(0)
        guide.screenshot(path=str(OUT / 'nl-mainnet-backup-360.png'))
        guide.get_by_label(S['nl']['mainBackupAck'], exact=True).check()
        next_step(); screen(T['nl']['moveLabels'][3]); next_step(); screen(T['nl']['moveLabels'][4])
        expect(guide.get_by_role('button', name=T['nl']['openImportTools'], exact=True)).to_have_count(0)
        expect(guide.get_by_text(T['nl']['importPending'], exact=True)).to_be_visible()
        next_step(); screen(T['nl']['continueApp']); previous(); previous(); previous()
        ok('Migration has seven separate pages, working Back and a required Mainnet backup checkpoint')
        ok('The disabled import gate is stated honestly and is never activated')
        language = app.locator('#calorieapp-language-select')
        app.locator('details').filter(has=language).locator('summary').click()
        for locale in T:
            language.select_option(locale)
            expect(title).to_have_text(S[locale]['mainBackupTitle'])
            expect(guide.get_by_text(S[locale]['mainBackupText'], exact=True)).to_be_visible()
            expect(guide).to_have_attribute('dir', 'rtl' if locale in ['ar', 'ur'] else 'ltr')
            for width in [360, 412, 1440]:
                page.set_viewport_size({'width': width, 'height': 900})
                geometry = guide.evaluate('''node => ({overflow:document.documentElement.scrollWidth>innerWidth, width:node.scrollWidth>node.clientWidth, font:getComputedStyle(node).fontFamily, title:getComputedStyle(node.querySelector('h2')).fontSize, screens:node.querySelectorAll('[data-account-guide-screen]').length})''')
                ok(f'{locale} {width}px: one native screen, normal app type and no overflow', not geometry['overflow'] and not geometry['width'] and 'Segoe UI' in geometry['font'] and geometry['title'] == '20px' and geometry['screens'] == 1)
            page.set_viewport_size({'width': 360, 'height': 900})
            if locale in ['nl', 'en', 'ar']:
                guide.screenshot(path=str(OUT / f'{locale}-migration-360.png'))
        language.select_option('nl')
        # Check only booleans; never include even the synthetic secret in evidence.
        clean_storage = title.evaluate('''(_, seed) => !JSON.stringify({...sessionStorage,...localStorage}).includes(seed)''', SEED)
        clean_messages = page.evaluate('(seed)=>!JSON.stringify(window.guideMessages).includes(seed)', SEED)
        ok('Neither storage nor parent-window messages contain recovery material', clean_storage and clean_messages)
        app.get_by_role('button', name=S['nl']['backToAccount'], exact=True).click()
        app.get_by_role('button', name=T['nl']['testRoute'], exact=True).click()
        # The same test-account route resumes at its final page.
        screen(S['nl']['stepReturn']); previous(); previous(); previous()
        screen(S['nl']['saveTitle'])
        guide.get_by_role('button', name=S['nl']['show'], exact=True).click()
        title.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        expect(secret).to_have_text(''); expect(secret).to_be_hidden()
        ok('Switching away from the document conceals the secret')
        title.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))")
        screen(S['nl']['beforeStart']); expect(guide.locator('code')).to_have_count(0)
        ok('Leaving the page clears the in-memory account and resets setup safely')
        ok('No real service, sign-in, import or account write was attempted', not report['unexpected_requests'])
        ok('No browser errors', not report['errors'])
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed'
        report['failure'] = str(error).replace(SEED, '[synthetic seed]')
        page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()
print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'faucet_requests': report['faucet_requests']}))
