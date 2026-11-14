/**
 * Fixed-size rolling buffer. Once full, adding an item drops the oldest one,
 * so the widget keeps memory use bounded however long the page stays open.
 */
export class RingBuffer<T> {
  private items: T[] = [];

  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new Error("capacity must be at least 1");
  }

  push(item: T) {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }

  /** Copy of the buffered items, oldest first. */
  toArray(): T[] {
    return [...this.items];
  }

  get size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }
}
