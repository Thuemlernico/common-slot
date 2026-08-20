import { DateTime } from 'luxon';
import { ProviderAvailabilityExtractor } from '../src/providers/router.js';
import { compareAvailability } from '../src/api/compare.js';
import { compareRequestSchema } from '../src/api/schema.js';

const links = process.argv.slice(2);
if (links.length < 2 || links.length > 10) {
  console.error('Usage: npm run smoke:live -- <public-booking-link-1> <public-booking-link-2> [more-links]');
  console.error('Links are read only for this process and are never printed or persisted.');
  process.exit(2);
}
const timezone = process.env.TZ_NAME ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
const start = DateTime.now().setZone(timezone).startOf('day');
const input = compareRequestSchema.parse({
  links,
  startDate: start.toISODate(),
  endDate: start.plus({ days: 14 }).toISODate(),
  timezone,
  durationMinutes: Number(process.env.DURATION_MINUTES ?? 30)
});
const result = await compareAvailability(input, new ProviderAvailabilityExtractor());
for (const [index, source] of result.sources.entries()) {
  console.log(`Source ${index + 1}: ${source.provider} — ${source.status}${source.message ? ` (${source.message})` : ''}`);
}
console.log(`Complete: ${result.complete}; common windows: ${result.commonSlots.length}; compared at: ${result.comparedAt}`);
if (!result.complete) process.exitCode = 1;
