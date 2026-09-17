import json, os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]; OUT=Path(os.environ.get('UX_EVIDENCE_DIR', str(ROOT/'ux-check-evidence/browser')))
OUT.mkdir(parents=True,exist_ok=True)
X=json.loads((ROOT/'frontend/config/food-experience-copy.json').read_text()); C=json.loads((ROOT/'frontend/config/food-ui-copy.json').read_text()); D=json.loads((ROOT/'frontend/config/food-discovery-copy.json').read_text()); S=json.loads((ROOT/'frontend/config/food-source-copy.json').read_text()); Y=json.loads((ROOT/'frontend/config/diary-copy.json').read_text()); A=json.loads((ROOT/'frontend/config/auth-ui-copy.json').read_text()); T=json.loads((ROOT/'frontend/config/testnet-entry-copy.json').read_text())
report={'mode':'Local Next.js production build; synthetic API and diary; no live writes','checks':[], 'writes':[], 'errors':[], 'blocked_external':[]}
food={'id':1,'product_name':'Synthetic oats','calories':200,'protein':10,'fat':4,'carbohydrates':32,'nutri_score':'A','portion_percentage':100,'barcode':'0012345678905','brand':'Test fixture','serving_size':'100 g','image_url':'https://tracker.example/pixel.gif','created_at':'2026-09-15T12:00:00Z'}
broken_food={**food,'id':2,'product_name':'Broken source photo','barcode':'0099999999999','image_url':'https://images.openfoodfacts.org/images/products/009/999/missing.jpg'}
entries=[]; logged_in=False; save_status=201

def ok(name,condition=True):
    assert condition,name
    report['checks'].append(name)

def routing(route):
    global entries
    req=route.request; u=urlsplit(req.url); path=u.path
    if u.hostname not in ['127.0.0.1','localhost']:
        report['blocked_external'].append(req.url); route.abort(); return
    if not path.startswith('/api/backend'):
        route.continue_(); return
    status=200; data={}
    if path.endswith('/health'): data={'status':'ok'}
    elif path.endswith('/api/identity/me'): status=401; data={'detail':'Isolated guest fixture'}
    elif path.endswith('/logs/overview'):
        if not logged_in: status=401; data={'detail':'Isolated guest fixture'}
        else:
            off=sum(bool(f.get('barcode')) for f in entries); usda=sum(not f.get('barcode') and str(f.get('brand','')).startswith('USDA FoodData Central · FDC ') for f in entries)
            data={'entries':entries,'next_before':None,'count':len(entries),'grades':{g:sum(bool(f.get('barcode')) and f.get('nutri_score')==g for f in entries) for g in 'ABCDE'},'sources':{'open_food_facts':off,'usda':usda,'other':len(entries)-off-usda},**{k:sum(f[k] for f in entries) for k in ['calories','protein','fat','carbohydrates']}}
    elif path.endswith('/search-food'): data={'results':[food,broken_food]}
    elif path.endswith('/log-food'):
        status=save_status; payload=req.post_data_json; report['writes'].append(payload)
        if status==201:
            saved={**payload,'id':len(entries)+10,'created_at':'2026-09-15T12:00:00Z'}; entries.append(saved); data=saved
        else: data={'detail':'Synthetic expired session'}
    else: status=404; data={'detail':'No fixture for this endpoint'}; report['errors'].append('Unexpected API: '+path)
    route.fulfill(status=status,content_type='application/json',body=json.dumps(data))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, **({'executable_path':os.environ['CALORIE_BROWSER_EXECUTABLE']} if os.environ.get('CALORIE_BROWSER_EXECUTABLE') else {}))
    context=browser.new_context(viewport={'width':360,'height':900},locale='nl-NL',service_workers='block')
    context.route('**/*',routing)
    page=context.new_page(); page.on('pageerror',lambda e:report['errors'].append(str(e)))
    try:
        page.goto('http://127.0.0.1:3100/?ui_lang=nl',wait_until='networkidle'); page.locator('html[lang="nl"]').wait_for()
        page.locator('button[data-age-option="adult"]').click()
        ok('Adult selection explicitly opens the full account and diary environment')
        expect(page.locator('[id^="calorie-tab-"]')).to_have_count(5)
        ok('Adult workspace has five bounded task tabs')
        page.locator('#calorie-tab-account').click()
        profile_heading=page.get_by_role('heading',name=T['nl']['profileTitle'],exact=True)
        page.locator('summary').filter(has=profile_heading).click()
        nickname=page.get_by_label(T['nl']['nicknameLabel'],exact=True)
        expect(nickname).to_be_visible()
        nickname.fill('Pieter test')
        page.get_by_role('button',name=T['nl']['saveNickname'],exact=True).click()
        expect(page.get_by_text(T['nl']['hello'].replace('{nickname}','Pieter test'),exact=True)).to_be_visible()
        ok('Nickname is optional and stored only in the current browser tab',page.evaluate("sessionStorage.getItem('calorieapp.nickname.v1')")=='Pieter test')
        page.evaluate("window.dispatchEvent(new CustomEvent('calorieapp:auth-state-changed',{detail:{authenticated:false}}))")
        expect(page.get_by_text(T['nl']['hello'].replace('{nickname}','Pieter test'),exact=True)).to_have_count(0)
        ok('Logout removes the tab-only nickname',page.evaluate("sessionStorage.getItem('calorieapp.nickname.v1')") is None)
        page.locator('#calorie-tab-journey').click()
        expect(page.get_by_role('heading',name=T['nl']['journeyTitle'],exact=True)).to_be_visible()
        expect(page.locator('[id^="account-journey-tab-"]')).to_have_count(4)
        expect(page.get_by_text(T['nl']['seedWarning'],exact=True)).to_be_visible()
        page.get_by_role('tab',name=T['nl']['moveStep'],exact=True).click()
        expect(page.get_by_text(T['nl']['importPending'],exact=True)).to_be_visible()
        ok('Guided setup exposes seed isolation and the fail-closed real-account route')
        page.get_by_role('tab',name=C['nl']['searchTitle'],exact=True).click()
        page.locator('#food-search').fill('oats'); page.get_by_role('button',name=C['nl']['search'],exact=True).click()
        expect(page.locator('img[src*="food-placeholder-off.svg"]')).to_have_count(2)
        ok('OFF results with rejected or broken photos get the local product illustration')
        ok('Rejected image URLs are not requested',not any('tracker.example' in url for url in report['blocked_external']))
        ok('A failed request to the trusted OFF image host falls back without breaking the product card',any('images.openfoodfacts.org' in url for url in report['blocked_external']))
        page.get_by_role('button',name=C['nl']['logProduct'].replace('{product}',food['product_name']),exact=True).click()
        expect(page.locator('#calorieapp-packaged-portion-editor')).to_be_visible()
        expect(page.locator('#calorieapp-packaged-portion-editor')).to_have_count(1)
        result_list=page.locator('ul[class*="max-h-[62vh]"]')
        ok('Product results use an internal scroll region beside one nearby portion editor',result_list.count()==1 and result_list.evaluate("node => getComputedStyle(node).overflowY === 'auto'"))
        page.get_by_role('button',name=C['nl']['cancel'],exact=True).click()
        page.get_by_role('tab',name=X['nl']['sourceTitle'],exact=True).click()
        usda=page.get_by_test_id('usda-food-search')
        usda.locator('input[type="search"]').fill('168878'); usda.locator('form button[type="submit"]').click()
        usda.get_by_role('button').filter(has_text='FDC 168878').click()
        chosen=page.get_by_test_id('usda-selected-food'); chosen.locator('input[inputmode="decimal"]').fill('75')
        expect(chosen.locator('img[src*="food-placeholder-usda.svg"]')).to_be_visible()
        ok('USDA food without a source photo gets the local alternative illustration')
        expect(chosen.get_by_test_id('usda-nutrition-preview')).to_contain_text('97,5')
        ok('Exact FDC 168878 / 75 grams produces 97.5 kcal from the actual local USDA catalogue')
        chosen.get_by_role('button',name=X['nl']['reviewAmount'],exact=True).click()
        confirm=chosen.locator('form'); expect(confirm).to_be_visible()
        ok('One inline confirmation, no duplicate nutrient preview',chosen.get_by_test_id('usda-nutrition-preview').count()==0)
        ok('No second USDA percentage controls',confirm.get_by_role('button',name=C['nl']['half'],exact=True).count()==0)
        ok('Nothing saved merely by reviewing',len(report['writes'])==0)
        for locale in X:
            page.locator('#calorieapp-display-language').select_option(locale) if page.locator('#calorieapp-display-language').count() else page.locator('select').first.select_option(locale)
            expect(page.locator('html')).to_have_attribute('lang',locale)
            expect(chosen.get_by_role('heading',name=X[locale]['confirmTitle'],exact=True)).to_be_visible()
            expect(chosen.locator('input[inputmode="decimal"]')).to_have_value('75')
            for width in [360,412,1440]:
                page.set_viewport_size({'width':width,'height':1000})
                overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
                ok(locale+' '+str(width)+'px: no horizontal page overflow',not overflow)
            page.set_viewport_size({'width':360,'height':1100})
            usda.screenshot(path=str(OUT/(locale+'-usda-360.png')))
            ok(locale+': translated confirmation and unchanged grams')
        page.locator('select').first.select_option('nl')
        page.set_viewport_size({'width':360,'height':900})
        chosen.locator('input[inputmode="decimal"]').fill('0')
        expect(chosen.locator('form')).to_have_count(0)
        expect(chosen.get_by_role('button',name=X['nl']['reviewAmount'],exact=True)).to_be_disabled()
        ok('Editing invalidates the confirmation; zero grams cannot be logged')
        chosen.locator('input[inputmode="decimal"]').fill('75')
        chosen.get_by_role('button',name=X['nl']['reviewAmount'],exact=True).click()
        chosen.get_by_role('button',name=C['nl']['cancel'],exact=True).click()
        ok('Cancel performs no write',len(report['writes'])==0)
        logged_in=True; entries=[dict(food)]
        page.evaluate("window.dispatchEvent(new CustomEvent('calorieapp:auth-state-changed',{detail:{authenticated:true}}))")
        page.get_by_role('tab',name=Y['nl']['title'],exact=True).click()
        expect(page.get_by_role('heading',name=S['nl']['gradeHeading'],exact=True)).to_be_visible()
        page.get_by_role('tab',name=X['nl']['sourceTitle'],exact=True).click()
        chosen.get_by_role('button',name=X['nl']['reviewAmount'],exact=True).click()
        chosen.locator('form button[type="submit"]').dblclick()
        expect(chosen.get_by_role('status')).to_contain_text('eetdagboek')
        ok('Double click sends exactly one synthetic diary POST',len(report['writes'])==1)
        payload=report['writes'][0]
        ok('Saved grams are not double-scaled',payload['calories']==97.5 and payload['protein']==2.02 and payload['fat']==0.21 and payload['carbohydrates']==21.15 and payload['portion_percentage']==100)
        ok('No invented Nutri-Score for USDA',payload['nutri_score'] is None)
        page.get_by_role('tab',name=Y['nl']['title'],exact=True).click()
        saved_food=page.get_by_role('button',name=C['nl']['viewDetails'].replace('{product}',payload['product_name']),exact=True)
        expect(saved_food).to_contain_text('Gegeten portie: 75 g')
        ok('The saved USDA diary card shows actual grams rather than an unexplained 100 percent')
        coverage=page.get_by_role('heading',name=S['nl']['gradeHeading'],exact=True).locator('..')
        expect(coverage).to_contain_text('1 van 1')
        expect(coverage).to_contain_text('USDA FoodData Central')
        ok('Diary separates one OFF grade from the USDA entry without treating USDA as an ungraded product')
        coverage.screenshot(path=str(OUT/'nl-diary-360.png'))
        page.screenshot(path=str(OUT/'nl-full-app-360.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1000}); page.screenshot(path=str(OUT/'nl-full-app-1440.png'),full_page=True)
        ok('No JavaScript runtime errors',not report['errors'])
        report['status']='passed'
    except Exception as e:
        report['status']='failed'; report['failure']=str(e)
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        (OUT/'failure-dom.txt').write_text(page.locator('body').inner_text())
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        browser.close()
print(json.dumps({'status':report['status'],'checks':len(report['checks']),'synthetic_writes':len(report['writes'])}))
