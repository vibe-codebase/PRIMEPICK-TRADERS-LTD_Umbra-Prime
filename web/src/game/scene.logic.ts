/** Seals for a found shadow: three without the lamp's outline, two after one look, one after more. */
export const starsFor = (hints: number) => (hints === 0 ? 3 : hints === 1 ? 2 : 1);
