import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';

const TIMEOUT_S = 15;

@Injectable()
export class PageFetcherService {
  fetch(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'curl',
        ['-s', '-L', '-m', String(TIMEOUT_S), '-f', url],
        { maxBuffer: 10 * 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            reject(new Error(`Failed to fetch ${url}: ${error.message}`));
            return;
          }
          if (!stdout || stdout.length === 0) {
            reject(new Error(`Empty response from ${url}`));
            return;
          }
          resolve(stdout);
        },
      );
    });
  }
}
