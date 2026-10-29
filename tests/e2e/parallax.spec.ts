import { test, expect } from '@playwright/test';

test.describe('PARALLAX End-to-End Verification Workflow', () => {
  test.beforeAll(async ({ request }) => {
    // Reset fixture to clean baseline before test suite
    await request.post('/api/v1/fixtures/reset');
  });

  test('complete mission lifecycle: workspace -> launch -> live execution -> evidence -> lineage -> report', async ({ page }) => {
    // 1. Visit Mission Workspace
    await page.goto('/');
    await expect(page).toHaveTitle(/PARALLAX/);
    await expect(page.locator('header')).toContainText('PARALLAX');
    await expect(page.locator('header')).toContainText('Verified Web Missions');

    // 2. Select the Student AI Tools preset
    const presetButton = page.locator('button:has-text("5 Student AI Tools (Signature Demo)")');
    await expect(presetButton).toBeVisible();
    await presetButton.click();

    // 3. Confirm prompt is populated and submit mission
    const promptTextarea = page.locator('#mission-prompt');
    await expect(promptTextarea).toContainText('Research five AI tools useful for university students');

    const submitBtn = page.locator('button:has-text("Compile & Execute Mission")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Live Execution page
    await page.waitForURL(/\/missions\/[a-f0-9-]+\/live/);
    await expect(page.locator('text=Execution DAG Stages')).toBeVisible();

    // Wait for the mission to complete execution (status banner changes to completed)
    await expect(page.locator('span:has-text("completed")').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('text=100%')).toBeVisible();

    // 5. Navigate to Evidence Explorer
    await page.locator('a:has-text("Evidence Explorer")').click();
    await page.waitForURL(/\/missions\/[a-f0-9-]+\/evidence/);
    await expect(page.locator('h1')).toContainText('Evidence Ledger Explorer');

    // Verify evidence cards are loaded with exact quotes and locators
    const evidenceCards = page.locator('div:has-text("StudyPilot AI")');
    await expect(evidenceCards.first()).toBeVisible();
    await expect(page.locator('text=/499/').first()).toBeVisible();

    // 6. Navigate to Lineage and Drift Map
    await page.locator('a:has-text("Lineage & Drift Map")').click();
    await page.waitForURL(/\/missions\/[a-f0-9-]+\/lineage/);
    await expect(page.locator('h1')).toContainText('Evidence Lineage & Drift Map');

    // Confirm React Flow canvas is visible
    const flowContainer = page.locator('.react-flow');
    await expect(flowContainer).toBeVisible();

    // 7. Navigate to Verification Report
    await page.locator('a:has-text("Verification Report")').click();
    await page.waitForURL(/\/missions\/[a-f0-9-]+\/report/);
    await expect(page.locator('text=Deterministic Audit Report')).toBeVisible();
    await expect(page.locator('text=PASS').first()).toBeVisible();

    // Verify artifact download buttons are present
    const downloadLinks = page.locator('a:has-text("Download")');
    await expect(downloadLinks.first()).toBeVisible();

    // 8. Navigate to Settings page
    await page.locator('a:has-text("Settings")').click();
    await page.waitForURL(/\/settings/);
    await expect(page.locator('h1')).toContainText('System Diagnostics');
    await expect(page.locator('text=demo-deterministic-v1').first()).toBeVisible();
    await expect(page.locator('text=Browser Security & SSRF Protection')).toBeVisible();
  });

  test('controlled source-drift detection and selective revalidation workflow', async ({ page, request }) => {
    // Stage A: Ensure baseline mission exists
    await page.goto('/');
    await page.locator('button:has-text("5 Student AI Tools (Signature Demo)")').click();
    await page.locator('button:has-text("Compile & Execute Mission")').click();
    await page.waitForURL(/\/missions\/[a-f0-9-]+\/live/);
    await expect(page.locator('span:has-text("completed")').first()).toBeVisible({ timeout: 25000 });

    // Stage C: Mutate the fixture via API
    const mutateRes = await request.post('/api/v1/fixtures/mutate', {
      data: { mutationType: 'price_increase' }
    });
    expect(mutateRes.ok()).toBeTruthy();
    const mutateJson = await mutateRes.json();
    expect(mutateJson.result.newPrice).toBe(699);

    // Stage D: Navigate to Lineage page and trigger drift check
    await page.locator('a:has-text("Lineage & Drift Map")').click();
    await page.waitForURL(/\/missions\/[a-f0-9-]+\/lineage/);

    const checkDriftBtn = page.locator('button:has-text("2. Check Source Drift")');
    await expect(checkDriftBtn).toBeVisible();
    await checkDriftBtn.click();

    // Confirm drift alert banner appears showing line diff
    await expect(page.locator('text=Source drift confirmed!')).toBeVisible({ timeout: 15000 });

    // Stage E & F: Click "3. Selective Revalidate"
    const revalidateBtn = page.locator('button:has-text("3. Selective Revalidate")');
    await expect(revalidateBtn).toBeVisible();
    await revalidateBtn.click();

    // Confirm revalidation success notification
    await expect(page.locator('text=Selective revalidation complete!')).toBeVisible({ timeout: 20000 });

    // Navigate to Verification Report to see updated v2 artifacts
    await page.locator('a:has-text("Verification Report")').click();
    await page.waitForURL(/\/missions\/[a-f0-9-]+\/report/);
    await expect(page.locator('text=v2').first()).toBeVisible();

    // Reset fixture
    await request.post('/api/v1/fixtures/reset');
  });
});
