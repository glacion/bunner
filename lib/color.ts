const palette = ["red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

export type Color = (typeof palette)[number];

const colors: readonly Color[] = Object.freeze([...palette]);

export const random = (pool: readonly Color[] = colors): Color => {
  if (pool.length === 0) throw new Error("color pool must contain at least one entry");
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
};

export default colors;
