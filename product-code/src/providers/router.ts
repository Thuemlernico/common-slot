import { classifyBookingUrl } from '../security/urls.js';
import { CalComAvailabilityExtractor } from './calcom.js';
import { CalendlyAvailabilityExtractor } from './calendly.js';
import { GoogleAppointmentExtractor } from './google.js';
import type { AvailabilityExtractor, ExtractedAvailability, ExtractionOptions } from './types.js';

export interface ProviderAdapters {
  google: AvailabilityExtractor;
  calendly: AvailabilityExtractor;
  calcom: AvailabilityExtractor;
}

export class ProviderAvailabilityExtractor implements AvailabilityExtractor {
  private readonly adapters: ProviderAdapters;

  constructor(adapters?: ProviderAdapters) {
    this.adapters = adapters ?? {
      google: new GoogleAppointmentExtractor(),
      calendly: new CalendlyAvailabilityExtractor(),
      calcom: new CalComAvailabilityExtractor()
    };
  }

  async extract(url: string, options: ExtractionOptions): Promise<ExtractedAvailability> {
    const provider = classifyBookingUrl(url);
    if (provider === 'unknown') throw new Error('The URL is not an allowed public booking provider');
    return this.adapters[provider].extract(url, options);
  }
}
