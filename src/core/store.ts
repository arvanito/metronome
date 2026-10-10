export type Listener<T> = (state: T, prev: T) => void;

/** Minimal observable state container. State is replaced (never mutated) on every update. */
export class Store<T extends object> {
  private listeners = new Set<Listener<T>>();

  constructor(private state: T) {}

  get(): T {
    return this.state;
  }

  set(update: Partial<T> | ((state: T) => Partial<T>)): void {
    const prev = this.state;
    const patch = typeof update === 'function' ? update(prev) : update;
    this.state = { ...prev, ...patch };
    this.listeners.forEach((fn) => fn(this.state, prev));
  }

  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
