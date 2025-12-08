import { generateRawLog, generateTwitterLog, generateLinkedInLog } from "./logFormats";

export function buildLogText(style, sessions) {
  switch (style) {
    case "twitter":
      return generateTwitterLog(sessions);
    case "linkedin":
      return generateLinkedInLog(sessions);
    case "raw":
    default:
      return generateRawLog(sessions);
  }
}
