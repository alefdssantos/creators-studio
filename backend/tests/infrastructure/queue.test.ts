/**
 * Tests for Task Queue
 *
 * Critical component for managing concurrent downloads.
 * Must correctly limit concurrency, handle timeouts, and track status.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { TaskQueue } from '../../src/infrastructure/queue.js'

describe('TaskQueue', () => {
  let queue: TaskQueue<string>

  beforeEach(() => {
    vi.useFakeTimers()
    queue = new TaskQueue<string>({
      maxConcurrent: 2,
      timeout: 5000,
      name: 'test-queue'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Operations', () => {
    it('should execute a single task', async () => {
      const result = await queue.add(async () => 'result')
      expect(result).toBe('result')
    })

    it('should execute tasks concurrently up to maxConcurrent', async () => {
      const executionOrder: number[] = []
      const startTimes: number[] = []

      const task1 = queue.add(async () => {
        startTimes.push(Date.now())
        await new Promise(r => setTimeout(r, 100))
        executionOrder.push(1)
        return 'task1'
      })

      const task2 = queue.add(async () => {
        startTimes.push(Date.now())
        await new Promise(r => setTimeout(r, 100))
        executionOrder.push(2)
        return 'task2'
      })

      // Advance time for both tasks
      vi.advanceTimersByTime(150)

      const results = await Promise.all([task1, task2])

      expect(results).toEqual(['task1', 'task2'])
      // Both should have started at approximately the same time
      expect(Math.abs(startTimes[0] - startTimes[1])).toBeLessThan(50)
    })

    it('should queue tasks when at max concurrency', async () => {
      const executionOrder: number[] = []

      // Start 3 tasks when maxConcurrent is 2
      const task1 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        executionOrder.push(1)
        return 'task1'
      })

      const task2 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        executionOrder.push(2)
        return 'task2'
      })

      const task3 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        executionOrder.push(3)
        return 'task3'
      })

      // Advance time for first batch
      vi.advanceTimersByTime(150)

      // Task3 should start now
      vi.advanceTimersByTime(150)

      const results = await Promise.all([task1, task2, task3])

      expect(results).toEqual(['task1', 'task2', 'task3'])
      // Task 3 should execute after task 1 or 2
      expect(executionOrder[2]).toBe(3)
    })
  })

  describe('Error Handling', () => {
    it('should propagate task errors', async () => {
      await expect(
        queue.add(async () => {
          throw new Error('Task failed')
        })
      ).rejects.toThrow('Task failed')
    })

    it('should continue processing queue after task error', async () => {
      const task1 = queue.add(async () => {
        throw new Error('Task 1 failed')
      }).catch(e => e.message)

      const task2 = queue.add(async () => {
        return 'task2 success'
      })

      const results = await Promise.all([task1, task2])

      expect(results[0]).toBe('Task 1 failed')
      expect(results[1]).toBe('task2 success')
    })
  })

  describe('Timeout', () => {
    it('should timeout long-running tasks', async () => {
      const promise = queue.add(async () => {
        await new Promise(r => setTimeout(r, 10000)) // Longer than timeout
        return 'should not reach'
      })

      // Advance past timeout
      vi.advanceTimersByTime(6000)

      await expect(promise).rejects.toThrow()
    })
  })

  describe('Status', () => {
    it('should track queue status', async () => {
      // Initially empty
      let status = queue.getStatus()
      expect(status.running).toBe(0)
      expect(status.queued).toBe(0)

      // Add tasks
      const task1 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        return 'task1'
      })

      const task2 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        return 'task2'
      })

      const task3 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        return 'task3'
      })

      // Check status - 2 running, 1 queued
      status = queue.getStatus()
      expect(status.running).toBe(2)
      expect(status.queued).toBe(1)

      // Complete tasks
      vi.advanceTimersByTime(150)
      await Promise.all([task1, task2])

      // Check status - 1 running (task3 started), 0 queued
      status = queue.getStatus()
      expect(status.running).toBe(1)
      expect(status.queued).toBe(0)

      vi.advanceTimersByTime(150)
      await task3

      // All done
      status = queue.getStatus()
      expect(status.running).toBe(0)
      expect(status.queued).toBe(0)
    })

    it('should track total processed and failed', async () => {
      // Successful task
      await queue.add(async () => 'success')

      // Failed task
      await queue.add(async () => {
        throw new Error('fail')
      }).catch(() => {})

      const status = queue.getStatus()
      expect(status.totalProcessed).toBe(2)
      expect(status.totalFailed).toBe(1)
    })
  })

  describe('Load Percentage', () => {
    it('should calculate load percentage correctly', async () => {
      // Empty queue
      expect(queue.getStatus().loadPercent).toBe(0)

      // Start 1 of 2 max concurrent
      const task1 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        return 'task1'
      })

      expect(queue.getStatus().loadPercent).toBe(50)

      // Start 2 of 2 max concurrent
      const task2 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        return 'task2'
      })

      expect(queue.getStatus().loadPercent).toBe(100)

      // Clean up
      vi.advanceTimersByTime(150)
      await Promise.all([task1, task2])
    })
  })

  describe('FIFO Order', () => {
    it('should process tasks in FIFO order', async () => {
      const executionOrder: number[] = []

      // Queue more tasks than maxConcurrent
      const tasks = [1, 2, 3, 4, 5].map(n =>
        queue.add(async () => {
          await new Promise(r => setTimeout(r, 50))
          executionOrder.push(n)
          return n
        })
      )

      // Process all tasks
      vi.advanceTimersByTime(200)
      await Promise.all(tasks)

      // First batch (1, 2) should complete first, then next batch (3, 4), then 5
      expect(executionOrder.slice(0, 2).sort()).toEqual([1, 2])
      expect(executionOrder.slice(2, 4).sort()).toEqual([3, 4])
      expect(executionOrder[4]).toBe(5)
    })
  })

  describe('Edge Cases', () => {
    it('should handle maxConcurrent of 1', async () => {
      const serialQueue = new TaskQueue<number>({
        maxConcurrent: 1,
        timeout: 5000,
        name: 'serial-queue'
      })

      const executionOrder: number[] = []

      const task1 = serialQueue.add(async () => {
        await new Promise(r => setTimeout(r, 50))
        executionOrder.push(1)
        return 1
      })

      const task2 = serialQueue.add(async () => {
        await new Promise(r => setTimeout(r, 50))
        executionOrder.push(2)
        return 2
      })

      // Process tasks
      vi.advanceTimersByTime(150)
      await Promise.all([task1, task2])

      // Should be strictly sequential
      expect(executionOrder).toEqual([1, 2])
    })

    it('should handle empty task function', async () => {
      const result = await queue.add(async () => undefined)
      expect(result).toBeUndefined()
    })

    it('should handle synchronous task', async () => {
      const result = await queue.add(() => Promise.resolve('sync'))
      expect(result).toBe('sync')
    })
  })
})
