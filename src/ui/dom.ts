type Child = Node | string | null | undefined | false;

/**
 * Creates an element. `onclick`-style props become event listeners, `class` sets the
 * class name, known DOM properties are assigned, anything else becomes an attribute.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value as EventListener);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (key in el && isWritable(el, key)) {
      (el as unknown as Record<string, unknown>)[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

/** Some DOM properties (e.g. input.list) are read-only and only settable as attributes. */
function isWritable(el: object, key: string): boolean {
  for (let proto: object | null = el; proto; proto = Object.getPrototypeOf(proto)) {
    const desc = Object.getOwnPropertyDescriptor(proto, key);
    if (desc) return desc.writable === true || desc.set !== undefined;
  }
  return false;
}

/** Labelled form row. */
export function field(label: string, control: HTMLElement): HTMLLabelElement {
  return h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), control);
}

/**
 * Runs `fn` for a key press, ignoring presses while typing in a form field
 * or with Ctrl/Alt/Meta held. Returns an unsubscribe function.
 */
export function onKey(keys: string[], fn: (e: KeyboardEvent) => void): () => void {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (target?.closest('input, select, textarea, [contenteditable]')) return;
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    fn(e);
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
