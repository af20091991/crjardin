// Déclarations minimales du lanceur de tests intégré (aucune dépendance npm
// ajoutée). Uniquement destinées au typecheck des fichiers de test.
declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeDefined(): void;
    toBeCloseTo(expected: number, precision?: number): void;
    toBeGreaterThan(expected: number): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    readonly not: Matchers;
  }
  export function describe(label: string, fn: () => void): void;
  export function test(label: string, fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): Matchers;
}
