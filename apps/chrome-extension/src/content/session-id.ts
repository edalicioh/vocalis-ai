export function createSessionId(now: number = Date.now(), random: number = Math.random()): string {
  return `session-tab-${now}-${random.toString(36).substring(2, 9)}`;
}
