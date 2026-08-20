import { expect, test } from '@playwright/test';

const response = {
  complete: true,
  comparedAt: '2026-08-19T18:00:00.000Z',
  timezone: 'UTC',
  durationMinutes: 30,
  sources: [
    { provider: 'Google Appointment Schedule', status: 'loaded', bookingUrl: 'https://calendar.google.com/calendar/appointments/schedules/fixture-a', appointmentDurationMinutes: 30 },
    { provider: 'Google Appointment Schedule', status: 'loaded', bookingUrl: 'https://calendar.app.google/fixture-b', appointmentDurationMinutes: 60 }
  ],
  commonSlots: [{ start: '2026-08-20T12:00:00.000Z', end: '2026-08-20T13:00:00.000Z' }],
  warning: 'Availability can change. Reconfirm on every provider page before booking; Common Slot does not reserve or book appointments.'
};

test('accessible compare, handoff, and stale-result journey', async ({ page }) => {
  await page.route('**/api/compare', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Find the time/ })).toBeVisible();
  await page.getByLabel(/Public booking links/).fill('https://calendar.google.com/calendar/appointments/schedules/fixture-a\nhttps://calendar.app.google/fixture-b');
  await page.getByLabel('Start date').fill('2026-08-20');
  await page.getByLabel('End date').fill('2026-08-27');
  await page.getByLabel('Timezone').fill('UTC');
  await page.getByRole('button', { name: /Find common times/ }).click();
  await expect(page.getByRole('status')).toContainText('Found 1 common');
  await expect(page.getByText('loaded', { exact: true })).toHaveCount(2);
  await page.locator('.slot').click();
  await expect(page.getByRole('heading', { name: 'Reconfirm before booking' })).toBeVisible();
  await expect(page.locator('#warning')).toHaveText(response.warning);
  const providerLinks = page.getByRole('link', { name: /Open Google/ });
  await expect(providerLinks).toHaveCount(2);
  await expect(providerLinks.nth(0)).toHaveAttribute('href', response.sources[0]!.bookingUrl);
  await expect(providerLinks.nth(1)).toHaveAttribute('href', response.sources[1]!.bookingUrl);
  await expect(providerLinks.nth(0)).toHaveAttribute('target', '_blank');
  await expect(providerLinks.nth(0)).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(providerLinks.nth(0)).toHaveAttribute('referrerpolicy', 'no-referrer');
  await page.getByLabel('Meeting length').selectOption('60');
  await expect(page.getByText('Inputs changed')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('stale');
  await expect(page.getByRole('heading', { name: 'Reconfirm before booking' })).toBeHidden();
  await expect(page.locator('.slot')).toBeDisabled();
});

const fillValidForm = async (page: import('@playwright/test').Page) => {
  await page.getByLabel(/Public booking links/).fill('https://calendar.google.com/calendar/appointments/schedules/fixture-a\nhttps://calendar.app.google/fixture-b');
  await page.getByLabel('Start date').fill('2026-08-20');
  await page.getByLabel('End date').fill('2026-08-27');
  await page.getByLabel('Timezone').fill('UTC');
};

test('validates link count before making an API request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/compare', (route) => { requests += 1; return route.abort(); });
  await page.goto('/');
  await page.getByLabel(/Public booking links/).fill('https://calendar.google.com/calendar/appointments/schedules/fixture-a');
  await page.getByRole('button', { name: /Find common times/ }).click();
  await expect(page.getByRole('alert')).toContainText('between 2 and 10');
  expect(requests).toBe(0);
});

test('shows loading, incomplete, and no-partial-result states accessibly', async ({ page }) => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/compare', async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...response,
        complete: false,
        sources: [response.sources[0], { provider: 'Calendly', status: 'unsupported', bookingUrl: 'https://calendly.com/example/schedule', message: 'This provider is detected but not supported in the MVP.' }],
        commonSlots: []
      })
    });
  });
  await page.goto('/');
  await fillValidForm(page);
  await page.getByRole('button', { name: /Find common times/ }).click();
  await expect(page.locator('#results')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('status')).toContainText('Reading public availability');
  release?.();
  await expect(page.getByRole('status')).toContainText('No partial common times');
  await expect(page.getByText('unsupported', { exact: true })).toBeVisible();
  await expect(page.locator('.slot')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Reconfirm before booking' })).toBeHidden();
});

test('distinguishes an empty comparison from an API error', async ({ page }) => {
  let mode: 'empty' | 'error' = 'empty';
  await page.route('**/api/compare', (route) => mode === 'empty'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...response, commonSlots: [] }) })
    : route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Comparison rejected' }) }));
  await page.goto('/');
  await fillValidForm(page);
  await page.getByRole('button', { name: /Find common times/ }).click();
  await expect(page.getByRole('status')).toContainText('no continuous window');
  await expect(page.getByText('No common times in this date range')).toBeVisible();

  mode = 'error';
  await page.getByRole('button', { name: /Find common times/ }).click();
  await expect(page.getByRole('alert')).toContainText('Comparison rejected');
  await expect(page.getByRole('status')).toContainText('No comparison was produced');
  await expect(page.locator('#result-state')).toHaveText('Error');
});
