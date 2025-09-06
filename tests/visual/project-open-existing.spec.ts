import { test, expect } from '@playwright/test';

// Adjust this path if needed for CI; it points to your local file per the request
const PROJECT_FILE = '/Users/chrismcleod/Development/ClaudeAccess/Project Files/Breakfast.transcript';

test('Open existing .transcript and render segments', async ({ page }) => {
  // Capture console for debugging
  page.on('console', (msg) => console.log('[page]', msg.text()));

  await page.goto('http://localhost:3000');

  // Load via IPC first, then inject into app context
  const projectData = await page.evaluate(async (filePath) => {
    if (!(window as any).electronAPI?.loadProject) {
      return { error: 'electronAPI.loadProject not available' };
    }
    const data = await (window as any).electronAPI.loadProject(filePath);
    return data;
  }, PROJECT_FILE);

  console.log('Loaded project via IPC. Segments:', projectData?.transcription?.segments?.length);

  // Inject into renderer app state
  await page.evaluate((data) => {
    const ev = new CustomEvent('test-load-project', { detail: data });
    window.dispatchEvent(ev);
  }, projectData);

  // Wait for the editor root to appear
  await page.waitForTimeout(1000);

  // Expect some segment nodes to be rendered or fallback content
  const hasSegments = await page.locator('[data-segment-id]').count();
  const bodyText = await page.locator('body').innerText();
  console.log('Segment elements count:', hasSegments);
  console.log('Body text snippet:', bodyText.slice(0, 200));

  // Take a screenshot for diagnosis
  await page.screenshot({ path: 'test-results/project-open-existing.png', fullPage: true });

  expect(projectData?.transcription?.segments?.length || 0).toBeGreaterThan(0);
  expect(hasSegments).toBeGreaterThan(0);
});

