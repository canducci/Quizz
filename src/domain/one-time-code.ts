import type { ShownBlock } from "./retake";

/** How long a one-time code works. Shared with the UI, which can't import the server module. */
export const CODE_MINUTES = 10;

/** Why a Learner's email or code was refused, or why the Assessment page won't start an Attempt. */
export type EntryError =
  | { reason: "badEmail" | "sendFailed" | "dailyCap" | "email" | "ip" | "locked" | "expired" }
  | { reason: "wrong"; left: number }
  | ShownBlock
  | { reason: "notInvited" | "closed"; creator: string };
