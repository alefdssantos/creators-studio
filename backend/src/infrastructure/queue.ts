/**
 * Enhanced download queue with timeout and abort support
 */

import { ErrorCode, ErrorType } from '../types/error.types.js';
import { AppError } from '../errors/base.error.js';

export interface QueueTask<T> {
  id: string;
  task: () => Promise<T>;
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  abortController?: AbortController;
  timeoutId?: NodeJS.Timeout;
  addedAt: number;
  startedAt?: number;
  settled?: boolean;
}

export interface QueueOptions {
  maxConcurrent: number;
  timeout?: number;
  name?: string;
}

export interface QueueStatus {
  running: number;
  queued: number;
  maxConcurrent: number;
  totalProcessed: number;
  totalFailed: number;
  loadPercent: number;
}

export class TaskQueue<T = unknown> {
  private maxConcurrent: number;
  private timeout: number;
  private name: string;
  private running = 0;
  private queue: QueueTask<T>[] = [];
  private runningTasks = new Map<string, QueueTask<T>>();
  private totalProcessed = 0;
  private totalFailed = 0;
  private taskIdCounter = 0;

  constructor(options: QueueOptions) {
    if (!Number.isInteger(options.maxConcurrent) || options.maxConcurrent < 1) {
      throw new Error('maxConcurrent must be a positive integer');
    }
    this.maxConcurrent = options.maxConcurrent;
    this.timeout = options.timeout || 0;
    this.name = options.name || 'queue';
  }

  /**
   * Add a task to the queue
   */
  async add(
    task: () => Promise<T>,
    options?: { timeout?: number; signal?: AbortSignal }
  ): Promise<T> {
    const taskId = `${this.name}-${++this.taskIdCounter}`;
    const timeout = options?.timeout ?? this.timeout;

    return new Promise<T>((resolve, reject) => {
      const queueTask: QueueTask<T> = {
        id: taskId,
        task,
        resolve,
        reject,
        abortController: new AbortController(),
        addedAt: Date.now(),
      };

      // Handle external abort signal
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          this.abort(taskId);
        });
      }

      // Set timeout if configured
      if (timeout > 0) {
        queueTask.timeoutId = setTimeout(() => {
          this.abort(taskId, 'Queue timeout exceeded');
        }, timeout);
      }

      this.queue.push(queueTask);
      this.process();
    });
  }

  /**
   * Process next task in queue
   */
  private process(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const queueTask = this.queue.shift()!;
      this.running++;
      queueTask.startedAt = Date.now();
      this.runningTasks.set(queueTask.id, queueTask);
      void this.execute(queueTask);
    }
  }

  private async execute(queueTask: QueueTask<T>): Promise<void> {
    try {
      const result = await queueTask.task();
      if (!queueTask.settled) {
        queueTask.settled = true;
        this.totalProcessed++;
        queueTask.resolve(result);
      }
    } catch (error) {
      if (!queueTask.settled) {
        queueTask.settled = true;
        this.totalProcessed++;
        this.totalFailed++;
        queueTask.reject(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      if (queueTask.timeoutId) clearTimeout(queueTask.timeoutId);
      if (this.runningTasks.delete(queueTask.id)) {
        this.running--;
        this.process();
      }
    }
  }

  /**
   * Abort a specific task
   */
  abort(taskId: string, reason = 'Task aborted'): boolean {
    // Check if task is still in queue
    const queueIndex = this.queue.findIndex((t) => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      task.abortController?.abort();
      task.settled = true;
      this.totalProcessed++;
      this.totalFailed++;
      task.reject(new AppError(ErrorCode.QUEUE_TIMEOUT, ErrorType.QUEUE, reason));
      return true;
    }

    const runningTask = this.runningTasks.get(taskId);
    if (runningTask && !runningTask.settled) {
      if (runningTask.timeoutId) clearTimeout(runningTask.timeoutId);
      runningTask.abortController?.abort();
      runningTask.settled = true;
      this.totalProcessed++;
      this.totalFailed++;
      runningTask.reject(new AppError(ErrorCode.QUEUE_TIMEOUT, ErrorType.QUEUE, reason));
      return true;
    }

    return false;
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      loadPercent: this.getLoad(),
    };
  }

  /**
   * Get position in queue for a task
   */
  getPosition(taskId: string): number {
    const index = this.queue.findIndex((t) => t.id === taskId);
    return index === -1 ? -1 : index + 1;
  }

  /**
   * Clear all queued tasks
   */
  clear(): void {
    for (const task of this.queue) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      task.abortController?.abort();
      task.settled = true;
      this.totalProcessed++;
      this.totalFailed++;
      task.reject(new AppError(ErrorCode.QUEUE_TIMEOUT, ErrorType.QUEUE, 'Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.running === 0;
  }

  /**
   * Get current load percentage
   */
  getLoad(): number {
    return (this.running / this.maxConcurrent) * 100;
  }
}

export default TaskQueue;
