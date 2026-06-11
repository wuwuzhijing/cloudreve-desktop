import { CALLBACK_PATH, CLIENT_ID, CLIENT_SECRET } from "./constants";
import { invoke } from "@tauri-apps/api/core";
import { insecureHttpJson } from "./insecureHttp";

export const MIN_VERSION = "4.12.0";

export interface PingResponse {
  code: number;
  data: string;
  msg: string;
}

export type ValidationErrorType =
  | "httpError"
  | "apiError"
  | "versionTooLow"
  | "connectionFailed";

export interface ValidationError {
  type: ValidationErrorType;
  params: Record<string, string>;
}

/**
 * Compare two semver version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_token_expires_in: number;
}

interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Exchange authorization code for access and refresh tokens
 * @param siteUrl - The base URL of the Cloudreve site
 * @param code - The authorization code from OAuth callback
 * @param pkceVerifier - The PKCE code verifier used during authorization
 * @returns TokenResponse containing access_token, refresh_token, etc.
 * @throws ValidationError on failure
 */
export async function exchangeTokens(
  siteUrl: string,
  code: string,
  pkceVerifier: string
): Promise<TokenResponse> {
  const url = new URL("/api/v4/session/oauth/token", siteUrl);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    redirect_uri: CALLBACK_PATH,
    code_verifier: pkceVerifier,
  });

  let data: TokenResponse | TokenErrorResponse;

  try {
    data = await insecureHttpJson<TokenResponse | TokenErrorResponse>(
      url.toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    throw {
      type: "connectionFailed",
      params: { message },
    } as ValidationError;
  }

  if (!("access_token" in data)) {
    const errorData = data as TokenErrorResponse;

    throw {
      type: "apiError",
      params: {
        message:
          errorData.error_description ||
          errorData.error ||
          "Token exchange failed: " + JSON.stringify(data),
      },
    } as ValidationError;
  }

  return data as TokenResponse;
}

export async function validateSiteVersion(siteUrl: string): Promise<string> {
  try {
    console.log("call validate_site_ping_insecure:", siteUrl);

    const raw = await invoke<string>("validate_site_ping_insecure", {
      siteUrl,
    });

    console.log("validate_site_ping_insecure result:", raw);

    const data: PingResponse = JSON.parse(raw);

    if (data.code !== 0) {
      throw {
        type: "apiError",
        params: {
          message: data.msg || String(data.code),
        },
      } as ValidationError;
    }

    return data.data;
  } catch (e) {
    console.error("validateSiteVersion failed:", e);

    const message =
      e instanceof Error
        ? `${e.name}: ${e.message}\n${e.stack ?? ""}`
        : String(e);

    throw {
      type: "connectionFailed",
      params: { message },
    } as ValidationError;
  }
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "params" in error
  );
}
