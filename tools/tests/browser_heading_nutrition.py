import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get(
    "HEADING_NUTRITION_EVIDENCE_DIR",
    str(ROOT / "ux-check-evidence" / "heading-nutrition-browser"),
))
OUT.mkdir(parents=True, exist_ok=True)
PLUGIN = ROOT / "wordpress-plugins" / "calorietoken-heading-repair"
SCRIPT = (PLUGIN / "assets" / "nutrition-summary.js").read_text(encoding="utf-8")
CSS = (PLUGIN / "assets" / "app-focus.css").read_text(encoding="utf-8")
LOCALES = ["en", "nl", "zh-Hans", "hi", "es", "ar", "fr", "bn", "pt", "id", "ur"]

report = {
    "mode": "Synthetic WordPress/Xaman-card browser fixture; no live site, account or diary writes",
    "checks": [],
    "errors": [],
}


def ok(name, condition=True):
    assert condition, name
    report["checks"].append(name)


parent_html = f"""<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{{box-sizing:border-box}}body{{margin:0;padding:24px;background:#f3f4f8;font-family:Arial,sans-serif}}
.xl-card{{width:220px;max-width:100%;overflow:visible;border:2px solid #505ba9;border-radius:14px;background:#fff}}
#ctstyle-account-app{{width:100%;min-width:0;padding:12px}}
.ctstyle-account-app-brand{{display:flex;align-items:center;gap:8px;color:#008d36;font-weight:700}}
iframe{{display:none}}
{CSS}
</style></head><body>
<section class="xl-card"><div id="ctstyle-account-app"><div class="ctstyle-account-app-brand">CalorieApp</div></div></section>
<iframe title="CalorieApp" src="https://app.calorietoken.net/fixture"></iframe>
<iframe title="Untrusted" src="https://evil.example/fixture"></iframe>
<script>{SCRIPT}</script>
</body></html>"""
child_html = """<!doctype html><html><body><script>
window.lastNutritionPeriod = null;
window.addEventListener('message', event => { window.lastNutritionPeriod = event.data; });
window.sendNutrition = message => parent.postMessage(message, 'https://calorietoken.net');
</script></body></html>"""


def route_fixture(route):
    url = route.request.url
    if url.startswith("https://calorietoken.net/"):
        route.fulfill(status=200, content_type="text/html", body=parent_html)
    elif url.startswith("https://app.calorietoken.net/") or url.startswith("https://evil.example/"):
        route.fulfill(status=200, content_type="text/html", body=child_html)
    else:
        route.abort()


ready = {
    "type": "calorieapp:nutrition-summary",
    "version": 1,
    "status": "ready",
    "locale": "nl",
    "period": "week",
    "total": 7,
    "known": 4,
    "missing": 1,
    "counts": {"A": 2, "B": 1, "C": 0, "D": 0, "E": 1},
    "sources": {"open_food_facts": 5, "usda": 1, "other": 1},
}


with sync_playwright() as playwright:
    launch = {}
    if os.environ.get("CALORIE_BROWSER_EXECUTABLE"):
        launch["executable_path"] = os.environ["CALORIE_BROWSER_EXECUTABLE"]
    browser = playwright.chromium.launch(headless=True, **launch)
    context = browser.new_context(viewport={"width": 360, "height": 900}, service_workers="block")
    context.route("**/*", route_fixture)
    page = context.new_page()
    page.on("pageerror", lambda error: report["errors"].append(str(error)))
    try:
        page.goto("https://calorietoken.net/calorieapp/", wait_until="networkidle")
        app_frame = next(frame for frame in page.frames if frame.url.startswith("https://app.calorietoken.net/"))
        evil_frame = next(frame for frame in page.frames if frame.url.startswith("https://evil.example/"))
        summary = page.locator("#ct-calorieapp-nutrition-summary")
        ok("Summary is installed beside CalorieApp instead of inside the Xaman account block", summary.count() == 1 and summary.locator("xpath=ancestor::*[contains(concat(' ',normalize-space(@class),' '),' xl-card ')]").count() == 0)
        ok("Summary is hidden before trusted private data arrives", summary.is_hidden())

        evil_frame.evaluate("message => window.sendNutrition(message)", ready)
        page.wait_for_timeout(25)
        ok("An untrusted iframe cannot reveal a summary", summary.is_hidden())

        for locale in LOCALES:
            message = {**ready, "locale": locale}
            app_frame.evaluate("message => window.sendNutrition(message)", message)
            page.wait_for_function(
                "locale => { const node=document.querySelector('#ct-calorieapp-nutrition-summary'); return node && !node.hidden && node.lang===locale; }",
                arg=locale,
            )
            ok(f"{locale}: translated summary is visible")
            direction = summary.get_attribute("dir")
            ok(f"{locale}: correct text direction", direction == ("rtl" if locale in ["ar", "ur"] else "ltr"))
            for width in [360, 412, 1440]:
                page.set_viewport_size({"width": width, "height": 900})
                geometry = page.evaluate("""() => {
                  const summary=document.querySelector('#ct-calorieapp-nutrition-summary');
                  const s=summary.getBoundingClientRect();
                  return {
                    pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                    summaryOverflow: summary.scrollWidth > summary.clientWidth,
                    inside: s.left >= 0 && s.right <= document.documentElement.clientWidth + 0.5,
                  };
                }""")
                ok(f"{locale} {width}px: no page or summary overflow", not geometry["pageOverflow"] and not geometry["summaryOverflow"] and geometry["inside"])

        app_frame.evaluate("message => window.sendNutrition(message)", {**ready, "locale": "nl"})
        page.wait_for_function("document.querySelector('#ct-calorieapp-nutrition-summary').lang === 'nl'")
        source_values = page.locator("[data-ct-nutrition-source] dd").all_text_contents()
        ok("The Xaman card shows the exact OFF, USDA and other source counts", source_values == ["5", "1", "1"])
        ok("The exact A-E counts also render as one proportional indicator bar", summary.locator(".ct-calorieapp-nutrition-bar .ct-calorieapp-nutrition-segment").count() == 3)
        ok("Score coverage is explicit against all seven logged entries", "4 van 7" in summary.locator(".ct-calorieapp-nutrition-coverage").inner_text())
        colours = summary.locator(".ct-calorieapp-nutrition-segment").evaluate_all("nodes => nodes.map(node => getComputedStyle(node).backgroundColor)")
        ok("The proportional bar renders three different, non-transparent grade colours", len(set(colours)) == 3 and "rgba(0, 0, 0, 0)" not in colours)
        ok("Source details start collapsed", not summary.locator(".ct-calorieapp-nutrition-details").evaluate("node => node.open"))

        ungraded = {**ready, "total": 3, "known": 0, "missing": 1,
                    "counts": {grade: 0 for grade in "ABCDE"},
                    "sources": {"open_food_facts": 1, "usda": 2, "other": 0}}
        app_frame.evaluate("message => window.sendNutrition(message)", ungraded)
        page.wait_for_function("document.querySelector('.ct-calorieapp-nutrition-bar').hidden")
        ok("Three ungraded logs remain visibly counted", "3" in summary.locator(".ct-calorieapp-nutrition-logged").inner_text())
        ok("The ungraded week hides its empty bar and zero counters", summary.locator(".ct-calorieapp-nutrition-bar").is_hidden() and summary.locator(".ct-calorieapp-nutrition-counts").is_hidden())
        page.locator("body").screenshot(path=str(OUT / "nl-week-without-grades-360.png"))
        app_frame.evaluate("message => window.sendNutrition(message)", ready)
        page.wait_for_function("!document.querySelector('.ct-calorieapp-nutrition-bar').hidden")
        ok("Changing to a graded period restores the coloured bar")

        summary.locator('[data-ct-nutrition-period="month"]').click()
        page.wait_for_function("document.querySelector('#ct-calorieapp-nutrition-summary').dataset.state === 'loading'")
        # This fixture deliberately hides its iframe. Chromium can suspend
        # animation frames there, so wait for the message on a timer instead.
        app_frame.wait_for_function(
            "window.lastNutritionPeriod && window.lastNutritionPeriod.period === 'month'",
            polling=50,
        )
        received = app_frame.evaluate("window.lastNutritionPeriod")
        ok("Period control sends only the fixed preset to the exact app frame", received == {
            "type": "calorieapp:nutrition-period", "version": 1, "period": "month",
        })
        ok("Loading hides stale aggregate counts", summary.locator(".ct-calorieapp-nutrition-body").is_hidden())
        app_frame.evaluate("message => window.sendNutrition(message)", {**ready, "period": "month"})
        page.wait_for_function("document.querySelector('#ct-calorieapp-nutrition-summary').dataset.state === 'ready'")
        ok("A matching ready summary restores the compact counts")

        page.set_viewport_size({"width": 360, "height": 900})
        app_frame.evaluate("message => window.sendNutrition(message)", {**ready, "locale": "nl", "period": "month"})
        page.locator("body").screenshot(path=str(OUT / "nl-xaman-nutrition-360.png"))
        app_frame.evaluate("message => window.sendNutrition(message)", {**ready, "locale": "ar"})
        page.locator("body").screenshot(path=str(OUT / "ar-xaman-nutrition-360.png"))

        app_frame.evaluate("message => window.sendNutrition(message)", {**ready, "status": "signed_out"})
        page.wait_for_function("document.querySelector('#ct-calorieapp-nutrition-summary').hidden")
        ok("Sign-out removes the private summary immediately")
        ok("No browser runtime errors", not report["errors"])
        report["status"] = "passed"
    except Exception as error:
        report["status"] = "failed"
        report["failure"] = str(error)
        page.screenshot(path=str(OUT / "failure.png"), full_page=True)
        raise
    finally:
        (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()

print(json.dumps({"status": report["status"], "checks": len(report["checks"])}))
