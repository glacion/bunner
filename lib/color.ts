export type Color = "green" | "yellow" | "blue" | "magenta" | "cyan";
const colors: Color[] = ["green", "yellow", "blue", "magenta", "cyan"];
export const random = () => colors[Math.floor(Math.random() * colors.length)]!;

export default colors;
