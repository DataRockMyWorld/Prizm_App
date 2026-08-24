/** A worker must keep at least one service category — an empty set makes
 * them unmatchable by the matching engine. */
export function canRemoveCategory(current: number[]): boolean {
  return current.length > 1;
}
