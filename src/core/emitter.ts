/** Tiny typed event emitter. `Events` maps event names to payload types. */
export class Emitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void): () => void {
    (this.listeners[event] ??= new Set()).add(fn);
    return () => this.listeners[event]?.delete(fn);
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners[event]?.forEach((fn) => fn(payload));
  }
}
