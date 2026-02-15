import { Injectable } from '@nestjs/common';

const TIMEOUT_MS = 15_000;

@Injectable()
export class PageFetcherService {
  async fetch(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CRA-AI-Tools/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('html') && !contentType.includes('xml') && !contentType.includes('text/plain')) {
        throw new Error(`Unexpected content type: ${contentType}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
