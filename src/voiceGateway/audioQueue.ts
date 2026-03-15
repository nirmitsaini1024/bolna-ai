/**
 * AudioQueue manages buffered audio chunks for each call session.
 * 
 * Purpose:
 * - Buffer incoming audio chunks from Twilio
 * - Provide chunks to downstream consumers (STT, recording, etc.)
 * - Handle backpressure when consumers are slower than producers
 * 
 * Design:
 * - Simple in-memory queue using array
 * - Thread-safe for single-threaded Node.js event loop
 * - Non-blocking push/pop operations
 * 
 * Production considerations:
 * - Monitor queue size to detect consumer lag
 * - Implement max size limit to prevent memory exhaustion
 * - Add metrics for queue depth and throughput
 */

export class AudioQueue {
  private queue: Buffer[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  push(chunk: Buffer): boolean {
    if (this.queue.length >= this.maxSize) {
      return false;
    }
    
    this.queue.push(chunk);
    return true;
  }

  getNextChunk(): Buffer | null {
    return this.queue.shift() || null;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
