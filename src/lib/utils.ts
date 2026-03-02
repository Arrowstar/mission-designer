// ============================================================
// ID generation utility
// ============================================================

let _counter = 0;

export function generateId(): string {
    _counter++;
    return `${Date.now().toString(36)}-${_counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
