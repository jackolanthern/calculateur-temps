const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('mode Expression : résultats préremplis affichés', async ({ page }) => {
  const out = page.locator('#nm-out');
  await expect(out).toContainText('1 h 30 min'); // 1h + 30min
  await expect(out).toContainText('= 6');        // 3h / 30min
  await expect(out).toContainText('ans');         // 1/1/2000 - 1/6/1990
});

test('mode Expression : calcul mis à jour en direct', async ({ page }) => {
  await page.locator('#nm-input').fill('2h -> min');
  await expect(page.locator('#nm-out')).toContainText('120 minutes');
});

test('mode Expression : conversion vers année = décomposition lisible', async ({ page }) => {
  await page.locator('#nm-input').fill('1128 days in y');
  await expect(page.locator('#nm-out')).toContainText('3 ans 1 mois 3 j');
});

test('mode Expression : date + durée = date', async ({ page }) => {
  await page.locator('#nm-input').fill('1/2/2000 + 1j');
  await expect(page.locator('#nm-out')).toContainText('2/2/2000');
});

test('mode Expression : mots-clés today / tomorrow', async ({ page }) => {
  const year = String(new Date().getFullYear());
  await page.locator('#nm-input').fill('today\ntomorrow - today');
  const out = page.locator('#nm-out');
  await expect(out).toContainText(year); // today affiche la date courante
  await expect(out).toContainText('1 j'); // tomorrow - today = 1 jour
});

test('mode Expression : erreur affichée proprement', async ({ page }) => {
  await page.locator('#nm-input').fill('1h / 0');
  await expect(page.locator('#nm-out')).toContainText('Division par zéro');
});

test('bascule Expression <-> Formulaire', async ({ page }) => {
  await expect(page.locator('#numi')).toBeVisible();
  await page.getByRole('button', { name: 'Formulaire' }).click();
  await expect(page.locator('#form')).toBeVisible();
  await expect(page.locator('#numi')).toBeHidden();
});

test('Arithmétique : Durée B / Nombre se cachent selon l\'opération', async ({ page }) => {
  await page.getByRole('button', { name: 'Formulaire' }).click();
  await page.getByRole('tab', { name: 'Arithmétique' }).click();

  // A + B (durée) : Durée B visible, Nombre caché
  await expect(page.locator('#ar-b')).toBeVisible();
  await expect(page.locator('#ar-n-field')).toBeHidden();

  // A × n : Nombre visible, Durée B caché
  await page.locator('#ar-op').selectOption('mul');
  await expect(page.locator('#ar-n-field')).toBeVisible();
  await expect(page.locator('#ar-b')).toBeHidden();
});

test('pas de débordement horizontal sur les durées', async ({ page }) => {
  await page.getByRole('button', { name: 'Formulaire' }).click();
  await page.getByRole('tab', { name: 'Arithmétique' }).click();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflows).toBe(false);
});

test('variables & références (Numi)', async ({ page }) => {
  await page.locator('#nm-input').fill('x = 2h\nx + 30min');
  const out = page.locator('#nm-out');
  await expect(out).toContainText('x = 2 h');      // ligne d'affectation
  await expect(out).toContainText('2 h 30 min');   // x réutilisé
});

test('parenthèses (Numi)', async ({ page }) => {
  await page.locator('#nm-input').fill('(1h + 30min) * 2');
  await expect(page.locator('#nm-out')).toContainText('3 h');
});

test('persistance + permalien : la saisie survit au rechargement', async ({ page }) => {
  await page.locator('#nm-input').fill('2h + 2h');
  await expect.poll(() => page.evaluate(() => location.hash)).not.toBe(''); // hash mis à jour
  await page.reload();
  await expect(page.locator('#nm-input')).toHaveValue('2h + 2h');
});

test('copie au clic : une ligne de résultat -> toast', async ({ page }) => {
  await page.locator('#nm-out .rline[data-copy]').first().click();
  await expect(page.locator('#toast')).toHaveText('Copié');
});

test('bouton de partage : copie le lien', async ({ page }) => {
  await page.getByRole('button', { name: 'Copier le lien' }).click();
  await expect(page.locator('#toast')).toHaveText('Lien copié');
});

test('thème : Auto -> Clair -> Sombre', async ({ page }) => {
  const btn = page.locator('#theme-btn');
  await expect(btn).toHaveText('Auto');
  await btn.click();
  await expect(btn).toHaveText('Clair');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test.describe('mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('résultats Numi entièrement visibles (pas tronqués)', async ({ page }) => {
    const out = page.locator('#nm-out');
    await expect(out).toContainText('1 h 30 min'); // résultat complet visible
    // la zone résultats ne déborde pas horizontalement (sinon contenu coupé)
    const clipped = await out.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped).toBe(false);
  });

  test('pas de débordement horizontal de la page (tous les modes/onglets)', async ({ page }) => {
    const noOverflow = () => page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(await noOverflow()).toBe(true); // mode Expression
    await page.getByRole('button', { name: 'Formulaire' }).click();
    for (const tab of ['Écart', 'Conversion', 'Arithmétique']) {
      await page.getByRole('tab', { name: tab }).click();
      expect(await noOverflow()).toBe(true);
    }
  });
});
