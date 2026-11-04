// Shared by the canvas and the OA panel; employee names never include their provider.
let selected: string | null = null;
const listeners = new Set<(id: string | null) => void>();
export function selectEmployee(id: string | null) {
  selected = id;
  listeners.forEach((listener) => listener(id));
}
export function onEmployeeSelected(listener: (id: string | null) => void) {
  listeners.add(listener);
  listener(selected);
}
export const isEmployeeSelected = (id: string) => selected === id;
