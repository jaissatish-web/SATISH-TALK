// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { loadTeamAccess, saveTeamAccess, forgetTeamAccess } from "../src/lib/radio/session";
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it("remembers team credentials across loads and forgets on leave", () => {
  expect(loadTeamAccess()).toBeNull();
  expect(saveTeamAccess("a".repeat(43), "private-code")).toBe(true);
  expect(loadTeamAccess()).toEqual({token: "a".repeat(43), code: "private-code"});
  forgetTeamAccess();
  expect(loadTeamAccess()).toBeNull();
});
it("rejects malformed saved access", () => {
  localStorage.setItem("satish-talk:remembered-access", '{bad');
  expect(loadTeamAccess()).toBeNull();
  localStorage.setItem("satish-talk:remembered-access", JSON.stringify({token: "short",code:"123"}));
  expect(loadTeamAccess()).toBeNull();
});
it("handles blocked storage without crashing", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(saveTeamAccess("a".repeat(43), "private-code")).toBe(false);
});
