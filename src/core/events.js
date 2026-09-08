/**
 * Tiny synchronous event emitter used to decouple the simulation from
 * presentation (renderer, HUD, audio, commentary).
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const set = this.listeners.get(type);
    if (set) set.delete(fn);
  }

  emit(type, payload) {
    const set = this.listeners.get(type);
    if (set) for (const fn of Array.from(set)) fn(payload);
    const all = this.listeners.get('*');
    if (all) for (const fn of Array.from(all)) fn(type, payload);
  }

  clear() {
    this.listeners.clear();
  }
}
