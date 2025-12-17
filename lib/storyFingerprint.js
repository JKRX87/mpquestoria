import crypto from "crypto";

export function makeStoryFingerprint(intro) {
  const base = `
${intro.setting}
${intro.role}
${intro.goal}
`.toLowerCase().trim();

  return crypto.createHash("sha256").update(base).digest("hex");
}
