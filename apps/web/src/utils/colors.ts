const AVATAR_COLORS = [
  { bg: "#5865F2", text: "#fff" },      // blurple
  { bg: "#57F287", text: "#1a1a2e" },    // green
  { bg: "#FEE75C", text: "#1a1a2e" },    // yellow
  { bg: "#EB459E", text: "#fff" },       // fuchsia
  { bg: "#ED4245", text: "#fff" },       // red
  { bg: "#3BA55D", text: "#fff" },       // dark green
  { bg: "#FAA61A", text: "#1a1a2e" },    // orange
  { bg: "#E67E22", text: "#fff" },       // dark orange
  { bg: "#9B59B6", text: "#fff" },       // purple
  { bg: "#1ABC9C", text: "#1a1a2e" },    // teal
];

export function getAvatarColor(userId: string): { bg: string; text: string } {
  const hash = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
