export const PLANNING_MAX_BYTES = 15 * 1024 * 1024;

export function validateClientId(id: string) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Client invalide");
}
