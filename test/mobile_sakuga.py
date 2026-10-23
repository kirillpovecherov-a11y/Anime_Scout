"""Fixture-only responsive smoke test: never requests real source media."""
import os
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
url = 'http://anime-scout.test'
posts = [{'id': n, 'file_url': f'https://www.sakugabooru.com/data/{n}.mp4',
          'preview_url': f'https://www.sakugabooru.com/data/preview/{n}.jpg',
          'file_ext': 'mp4', 'width': 1280, 'height': 720, 'file_size': 10000}
         for n in range(1, 21)]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
        for width in [320, 390, 430]:
            context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=True, has_touch=True, accept_downloads=True)
            page = context.new_page()
            errors = []
            media = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            def route_request(route):
                request_url = route.request.url
                if request_url.startswith(url):
                    name = request_url.removeprefix(url).split('?')[0].strip('/') or 'index.html'
                    content_type = 'text/html' if name.endswith('.html') else 'text/javascript'
                    route.fulfill(body=(ROOT / name).read_bytes(), content_type=content_type)
                elif '/post.json?' in request_url:
                    route.fulfill(json=posts + [posts[0]], headers={'Access-Control-Allow-Origin': '*'})
                else:
                    if request_url.endswith('.mp4'):
                        media.append(request_url)
                    route.abort()
            page.route('**/*', route_request)
            page.goto(url)
            assert page.locator('#youtubeSearch').is_visible()
            page.locator('#sakugaSearch').click()
            page.locator('#sakugaItems article').first.wait_for()
            assert page.locator('#sakugaItems article').count() == 20
            assert not media, 'Search must not request source video'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'overflow at {width}'
            cards = page.locator('#sakugaItems article')
            for n in range(10):
                cards.nth(n).locator('input').check()
            cards.nth(10).locator('input').check()
            assert not cards.nth(10).locator('input').is_checked()
            page.locator('#sakugaTarget').select_option('20')
            cards.nth(10).locator('input').check()
            cards.first.get_by_role('button', name='Одобрить', exact=True).click()
            cards.nth(1).get_by_role('button', name='Отклонить', exact=True).click()
            assert not cards.nth(1).locator('input').is_checked()
            page.reload()
            assert page.locator('#sakugaTarget').input_value() == '20'
            cards = page.locator('#sakugaItems article')
            assert cards.first.locator('input').is_checked()
            assert 'Одобрено' in cards.first.inner_text()
            # One successful metadata response, one isolated media failure.
            page.evaluate("Sakuga.metadata = async () => 12.5")
            cards.first.get_by_role('button', name='Определить длительность').click()
            page.wait_for_function("document.querySelector('#sakugaTotal').textContent.includes('12.5')")
            page.evaluate("Sakuga.metadata = async () => null")
            cards.nth(2).get_by_role('button', name='Определить длительность').click()
            page.wait_for_function("document.querySelectorAll('#sakugaItems article')[2].textContent.includes('CORS')")
            with page.expect_download() as info:
                page.locator('#sakugaExport').click()
            import json
            manifest = json.loads(pathlib.Path(info.value.path()).read_text())
            assert len(manifest['items']) == 1
            assert manifest['items'][0]['duration'] == 12.5
            assert manifest['download_requested'] is False
            # Simulate cross-origin/network failure; keep existing results.
            page.unroute('**/*', route_request)
            page.route('**/post.json?*', lambda route: route.abort())
            page.locator('#sakugaSearch').click()
            page.wait_for_function("document.querySelector('#sakugaStatus').textContent.includes('CORS')")
            assert page.locator('#sakugaItems article').count() == 20
            assert not errors, errors
            assert not media
            print(f'PASS mobile {width}px: layout, limit, decisions/reload, duration fallback, manifest, API failure, YouTube present; no video requests')
            context.close()
        browser.close()
finally:
    pass
