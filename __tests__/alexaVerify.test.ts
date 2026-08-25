import { describe, it, expect } from "vitest";
import { validateCertChainUrl, isTimestampFresh } from "@/lib/alexaVerify";

describe("validateCertChainUrl", () => {
  it("accepts a well-formed Amazon cert chain URL", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com/echo.api/echo-api-cert-6-ats.pem")).toBe(true);
  });

  it("accepts an explicit default https port", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem")).toBe(true);
  });

  it("rejects a non-https protocol", () => {
    expect(validateCertChainUrl("http://s3.amazonaws.com/echo.api/echo-api-cert.pem")).toBe(false);
  });

  it("rejects a hostname that is not s3.amazonaws.com", () => {
    expect(validateCertChainUrl("https://evil.com/echo.api/echo-api-cert.pem")).toBe(false);
  });

  it("rejects a path that does not start with /echo.api/", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com/not-echo/echo-api-cert.pem")).toBe(false);
  });

  it("rejects a non-standard port", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com:8443/echo.api/echo-api-cert.pem")).toBe(false);
  });

  it("rejects an unparseable URL", () => {
    expect(validateCertChainUrl("not a url")).toBe(false);
  });
});

describe("isTimestampFresh", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");

  it("accepts a timestamp equal to now", () => {
    expect(isTimestampFresh("2026-08-24T12:00:00.000Z", now)).toBe(true);
  });

  it("accepts a timestamp 100 seconds old", () => {
    expect(isTimestampFresh("2026-08-24T11:58:20.000Z", now)).toBe(true);
  });

  it("rejects a timestamp 200 seconds old", () => {
    expect(isTimestampFresh("2026-08-24T11:56:40.000Z", now)).toBe(false);
  });

  it("rejects a timestamp 200 seconds in the future", () => {
    expect(isTimestampFresh("2026-08-24T12:03:20.000Z", now)).toBe(false);
  });

  it("rejects an unparseable timestamp", () => {
    expect(isTimestampFresh("not-a-date", now)).toBe(false);
  });
});
