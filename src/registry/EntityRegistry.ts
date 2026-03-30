// Maps designer-facing string keys (from level JSON and network messages) to
// bitECS integer entity IDs. UUIDs appear only in JSON and network payloads —
// never in hot-path ECS queries (Decision 1).
export class EntityRegistry {
  private map = new Map<string, number>();

  register(key: string, eid: number): void {
    this.map.set(key, eid);
  }

  get(key: string): number {
    const eid = this.map.get(key);
    if (eid === undefined) throw new Error(`EntityRegistry: unknown key "${key}"`);
    return eid;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export const entityRegistry = new EntityRegistry();
