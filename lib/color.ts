export type Color = "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";
const colors: Color[] = ["red", "green", "yellow", "blue", "magenta", "cyan", "white"];
export const random = () => colors[Math.floor(Math.random() * colors.length)]!;
export default colors;
