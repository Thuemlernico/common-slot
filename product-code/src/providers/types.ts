export interface ExtractionOptions {
  timezone: string;
  startDate: string;
  endDate: string;
  signal?: AbortSignal;
}

export interface ExtractedAvailability {
  intervals: import('../domain/intervals.js').Interval[];
  appointmentDurationMinutes: number;
  canonicalUrl: string;
}

export interface AvailabilityExtractor {
  extract(url: string, options: ExtractionOptions): Promise<ExtractedAvailability>;
}
