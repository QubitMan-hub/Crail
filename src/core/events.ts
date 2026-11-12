/** Tiny event bus. Features talk to each other through events, never by importing each other. */
type Handler = (payload: any) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on<T = unknown>(name: string, fn: (payload: T) => void): () => void {
    let set = this.handlers.get(name);
    if (!set) this.handlers.set(name, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }

  emit<T = unknown>(name: string, payload?: T): void {
    this.handlers.get(name)?.forEach((fn) => fn(payload));
  }
}
