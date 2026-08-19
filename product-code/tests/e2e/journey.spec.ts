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
  await expect(page.getByRole('link', { name: /Open Google/ })).toHaveCount(2);
  await page.getByLabel('Meeting length').selectOption('60');
  await expect(page.getByText('Inputs changed')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('stale');
  await expect(page.getByRole('heading', { name: 'Reconfirm before booking' })).toBeHidden();
  await expect(page.locator('.slot')).toBeDisabled();
});
