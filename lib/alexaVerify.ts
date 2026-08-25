import crypto from "node:crypto";

const CERT_CHAIN_HOSTNAME = "s3.amazonaws.com";
const CERT_CHAIN_PATH_PREFIX = "/echo.api/";
const REQUIRED_SAN = "echo-api.amazon.com";
const TIMESTAMP_TOLERANCE_SECONDS = 150;

export function validateCertChainUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.hostname.toLowerCase() !== CERT_CHAIN_HOSTNAME) return false;
  if (!url.pathname.startsWith(CERT_CHAIN_PATH_PREFIX)) return false;
  if (url.port !== "" && url.port !== "443") return false;
  return true;
}

export function isTimestampFresh(timestamp: string, now: Date = new Date()): boolean {
  const requestTime = new Date(timestamp).getTime();
  if (Number.isNaN(requestTime)) return false;
  const diffSeconds = Math.abs(now.getTime() - requestTime) / 1000;
  return diffSeconds <= TIMESTAMP_TOLERANCE_SECONDS;
}

export async function verifyAlexaSignature(
  rawBody: string,
  signatureBase64: string,
  certChainUrl: string
): Promise<boolean> {
  if (!validateCertChainUrl(certChainUrl)) return false;

  let pem: string;
  try {
    const res = await fetch(certChainUrl);
    if (!res.ok) return false;
    pem = await res.text();
  } catch {
    return false;
  }

  let cert: crypto.X509Certificate;
  try {
    cert = new crypto.X509Certificate(pem);
  } catch {
    return false;
  }

  const now = new Date();
  if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) return false;
  if (!cert.checkHost(REQUIRED_SAN)) return false;

  try {
    const verifier = crypto.createVerify("RSA-SHA1");
    verifier.update(rawBody);
    return verifier.verify(cert.publicKey, signatureBase64, "base64");
  } catch {
    return false;
  }
}
