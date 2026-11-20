from pathlib import Path

from playwright.sync_api import sync_playwright


output_dir = Path("artifacts/onboarding")
output_dir.mkdir(parents=True, exist_ok=True)
steps = ["currency", "budget", "rent", "transport", "groceries", "unexpected"]


def open_step(page, step):
    page.goto(f"http://127.0.0.1:4173/#{step}", wait_until="networkidle")
    page.wait_for_selector(".onboarding-page")
    page.wait_for_function("document.querySelector('.onboarding-page img')?.complete")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page_errors = []
    browser.on('page', lambda page: page.on('pageerror', lambda error: page_errors.append(str(error))))

    # Le parcours complet vérifie l’état partagé et les règles métier sur mobile.
    page = browser.new_page(viewport={"width": 375, "height": 900})
    open_step(page, "currency")
    assert page.locator(".currency-card").count() == 4
    page.locator(".currency-search").fill("GBP")
    assert page.locator(".currency-card").count() == 1
    page.locator(".currency-search").fill("")
    page.locator(".currency-card").filter(has_text="MAD").click()
    page.get_by_role("button", name="Continuer").click(no_wait_after=True)
    page.locator("input[aria-label='Mon budget mensuel']").fill("300000")
    page.get_by_role("button", name="Continuer").click(no_wait_after=True)
    page.locator("input[aria-label='Montant prévu']").fill("120000")
    page.get_by_role("button", name="Continuer").click(no_wait_after=True)
    page.locator("input[aria-label='Montant prévu']").fill("20000")
    page.get_by_role("button", name="Continuer").click(no_wait_after=True)
    page.locator("input[aria-label='Montant prévu']").fill("45000")
    page.get_by_role("button", name="Continuer").click(no_wait_after=True)
    page.locator("input[aria-label='Montant prévu']").fill("150000")
    page.get_by_role("button", name="Continuer").click(no_wait_after=True)
    assert "dépasse" in page.locator(".onboarding-error").inner_text()
    page.locator("input[aria-label='Montant prévu']").fill("15000")
    page.get_by_role("button", name="Fermer la saisie").click()
    page.get_by_role("button", name="Revenir à l’étape précédente").click(no_wait_after=True)
    assert page.locator("input[aria-label='Montant prévu']").input_value() == "45000.00"
    page.get_by_role('button', name='Passer cette étape').click()
    assert page.locator("input[aria-label='Montant prévu']").input_value() == '15000.00'
    page.get_by_role('button', name='Continuer').click()
    assert page.url.endswith('#subscriptions')
    assert page.evaluate('localStorage.length') == 0
    page.go_back()
    page.go_back()
    assert page.url.endswith('#groceries')
    assert page.locator("input[aria-label='Montant prévu']").input_value() == '0.00'
    page.locator("input[aria-label='Montant prévu']").fill('-1')
    assert page.locator("input[aria-label='Montant prévu']").get_attribute('aria-invalid') == 'true'
    for _ in range(4):
        page.wait_for_function("document.querySelector('.onboarding-amount-dialog')?.open")
        page.get_by_role('button', name='Fermer la saisie').click()
        page.get_by_role('button', name='Revenir à l’étape précédente').click()
    assert page.url.endswith('#currency')
    page.locator('.currency-card').filter(has_text='EUR').click()
    page.get_by_role('button', name='Conserver ma devise').click()
    assert 'MAD' in page.locator('.currency-card.is-selected').inner_text()
    page.locator('.currency-card').filter(has_text='EUR').click()
    page.get_by_role('button', name='Changer d’espace de devise').click()
    page.get_by_role('button', name='Continuer').click()
    assert page.locator("input[aria-label='Mon budget mensuel']").input_value() == '0.00'
    assert page.locator('.donut-segment').count() == 1
    page.get_by_role('button', name='Fermer la saisie').click()
    page.get_by_role('button', name='Revenir à l’étape précédente').click()
    page.locator('.currency-card').filter(has_text='MAD').click()
    page.get_by_role('button', name='Continuer').click()
    assert page.locator("input[aria-label='Mon budget mensuel']").input_value() == '300000.00'
    page.close()

    page = browser.new_page()
    page.goto('http://127.0.0.1:4173/#signup', wait_until='networkidle')
    page.locator('#fullName').fill('Awa Démo')
    page.locator('#email').fill('awa@example.test')
    page.locator('#password').fill('demo12345')
    page.locator('#confirmPassword').fill('demo12345')
    page.route('**/register.php', lambda route: route.fulfill(status=201, content_type='application/json', body='{"data":{"state":{"onboardingCompleted":false,"currency":"XOF"}}}'))
    page.get_by_role('button', name='Créer mon compte').click()
    page.wait_for_url('**/#currency')
    assert page.url.endswith('#currency')
    page.close()

    # Chaque largeur reçoit une capture de chaque écran pour la revue visuelle.
    for width in (375, 390, 768, 1024, 1440):
        for index, step in enumerate(steps, start=1):
            page = browser.new_page(viewport={"width": width, "height": 900})
            open_step(page, step)
            print(width, step, flush=True)
            page.evaluate("""async (step) => {
              const {onboardingState} = await import('./src/app/onboardingState.js');
              onboardingState.budget = 250000;
              const keys = ['rent','transport','groceries','unexpected'];
              const values = [120000,20000,45000,15000];
              keys.forEach((key,index) => {onboardingState.allocations[key] = keys.indexOf(step) >= index ? values[index] : 0;});
              const {createOnboardingPage} = await import('./src/pages/onboarding.js');
              createOnboardingPage(document.querySelector('#app'), step, () => {});
              await Promise.all([...document.images].map(image => image.decode()));
              await Promise.all(document.getAnimations().map(animation => animation.finished));
            }""", step)
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            if step != 'currency':
                assert page.locator('.donut').get_attribute('aria-label').startswith('Budget prévu')
                assert page.locator('.donut').bounding_box()['height'] <= 305
            page.screenshot(path=output_dir / f"{index:02d}-{step}-{width}.png", full_page=True)
            if step != 'currency':
                amount = page.locator('.amount-row input')
                before = page.locator('.donut').get_attribute('aria-label')
                amount.fill('0')
                assert before != page.locator('.donut').get_attribute('aria-label')
                amount.focus()
                page.keyboard.press('Tab')
                assert page.locator('.onboarding-amount-dialog').evaluate('dialog => dialog.contains(document.activeElement)')
                assert page.locator(':focus-visible').count() > 0
            page.close()

    page = browser.new_page(reduced_motion='reduce')
    open_step(page, 'budget')
    page.locator('.amount-row input').fill('100')
    assert page.locator('.donut').evaluate('element => element.getAnimations({subtree:true}).length') == 0
    page.close()
    assert not page_errors, page_errors
    browser.close()
print("ONBOARDING_PLAYWRIGHT_PASS")
