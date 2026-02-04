/**
 * Automatic file cleanup service
 */

import fs from 'fs';
import path from 'path';
import { logEvents } from '../logging/logger.js';

export interface FileCleanupOptions {
  directory: string;
  maxAgeMs: number;
  intervalMs: number;
}

export class FileCleanup {
  private directory: string;
  private maxAge: number;
  private interval: NodeJS.Timeout | null = null;

  constructor(options: FileCleanupOptions) {
    this.directory = options.directory;
    this.maxAge = options.maxAgeMs;
  }

  /**
   * Start automatic cleanup
   */
  start(intervalMs: number): void {
    // Ensure directory exists
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }

    // Run immediate cleanup
    this.cleanup();

    // Schedule periodic cleanup
    this.interval = setInterval(() => this.cleanup(), intervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Run cleanup once
   */
  cleanup(): number {
    try {
      if (!fs.existsSync(this.directory)) {
        return 0;
      }

      const files = fs.readdirSync(this.directory);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.directory, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > this.maxAge) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch {
          // File may have been deleted by another process
        }
      }

      if (cleaned > 0) {
        logEvents.fileCleanup({ filesRemoved: cleaned });
      }

      return cleaned;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Delete a specific file
   */
  deleteFile(filename: string): boolean {
    try {
      const filePath = path.join(this.directory, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get list of files in directory
   */
  listFiles(): string[] {
    try {
      if (!fs.existsSync(this.directory)) {
        return [];
      }
      return fs.readdirSync(this.directory);
    } catch {
      return [];
    }
  }

  /**
   * Get directory stats
   */
  getStats(): { fileCount: number; totalSize: number } {
    try {
      if (!fs.existsSync(this.directory)) {
        return { fileCount: 0, totalSize: 0 };
      }

      const files = fs.readdirSync(this.directory);
      let totalSize = 0;

      for (const file of files) {
        try {
          const stats = fs.statSync(path.join(this.directory, file));
          totalSize += stats.size;
        } catch {
          // Skip files that can't be read
        }
      }

      return { fileCount: files.length, totalSize };
    } catch {
      return { fileCount: 0, totalSize: 0 };
    }
  }
}

export default FileCleanup;
