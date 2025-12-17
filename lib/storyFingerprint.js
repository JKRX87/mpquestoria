import crypto from "crypto";

export function makeStoryFingerprint(intro) {
  /**
   * intro = {
   *   setting: "...",
   *   role: "...",
   *   goal: "..."
   * }
   */

  const baseString = `
${intro.setting}
${intro.role}
${intro.goal}
`.toLowerCase().trim();

  return crypto
    .createHash("sha256")
    .update(baseString)
    .digest("hex");
}
