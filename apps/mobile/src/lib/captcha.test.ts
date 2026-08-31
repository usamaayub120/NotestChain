import { captchaPageUrl, parseCaptchaMessage } from "./captcha";

describe("native CAPTCHA bridge", () => {
  it("loads the first-party page in embedded mode", () => {
    expect(captchaPageUrl()).toBe("https://noteschain.org/mobile-captcha?embedded=1");
  });

  it("accepts only a non-empty token in the expected message envelope", () => {
    expect(parseCaptchaMessage(JSON.stringify({ type: "noteschain-captcha", token: "token-123" }))).toBe("token-123");
    expect(parseCaptchaMessage(JSON.stringify({ type: "other", token: "token-123" }))).toBeNull();
    expect(parseCaptchaMessage(JSON.stringify({ type: "noteschain-captcha", token: " " }))).toBeNull();
    expect(parseCaptchaMessage("not JSON")).toBeNull();
  });
});
