/**
 * ContentDividend Cloudflare Authorization Bridge
 * Phase B Step 5
 *
 * SAFE DEFAULT: observe-only.
 *
 * Cloudflare routes this Worker in front of the publisher's origin.
 * The Worker only asks ContentDividend for a licensing decision for
 * AI-looking requests. Normal visitors pass through.
 *
 * A User-Agent does NOT prove a license. A valid ContentDividend licensed-
 * content credential, current active grant, current scope version and exact
 * authorized URL are required for an "allow" licensing decision.
 */

const DEFAULT_AI_PATTERNS = [
  /GPTBot/i,
  /ChatGPT-User/i,
  /ClaudeBot/i,
  /Claude-User/i,
  /PerplexityBot/i,
  /Amazonbot/i,
  /Bytespider/i,
  /Applebot-Extended/i,
  /Google-Extended/i,
  /Meta-ExternalAgent/i,
  /cohere-ai/i,
  /CCBot/i,
  /YouBot/i
];

function looksLikeAI(request) {
  const ua = request.headers.get("user-agent") || "";
  return DEFAULT_AI_PATTERNS.some(re => re.test(ua));
}

function buyerLicenseKey(request) {
  // Buyers may send the existing ContentDividend licensed-content Bearer key.
  const auth = request.headers.get("authorization") || "";
  if (/^Bearer\s+cdlic_/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();

  // Alternate explicit header for integrations that reserve Authorization.
  const explicit = request.headers.get("x-contentdividend-license-key") || "";
  return explicit.trim();
}

async function askContentDividend(request, env) {
  const body = {
    site_id: env.CONTENTDIVIDEND_SITE_ID,
    url: request.url,
    method: request.method,
    user_agent: request.headers.get("user-agent") || "",
    cf_ray: request.headers.get("cf-ray") || ""
  };

  const headers = {
    "content-type": "application/json",
    "x-contentdividend-bridge-id": env.CONTENTDIVIDEND_BRIDGE_ID,
    "x-contentdividend-bridge-secret": env.CONTENTDIVIDEND_BRIDGE_SECRET
  };

  const key = buyerLicenseKey(request);
  if (key) headers["x-contentdividend-license-key"] = key;

  const base = (env.CONTENTDIVIDEND_API_BASE || "https://app.contentdividend.com").replace(/\/+$/, "");
  const response = await fetch(`${base}/v1/cloudflare/authorize`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  let data = {};
  try { data = await response.json(); } catch (_) {}

  if (!response.ok) {
    return {
      decision: "bridge_error",
      mode: "observe",
      allow: true,
      reason: data.detail || `ContentDividend bridge returned HTTP ${response.status}`
    };
  }
  return data;
}

export default {
  async fetch(request, env, ctx) {
    // Never interfere with ordinary visitors just because the bridge exists.
    if (!looksLikeAI(request)) {
      return fetch(request);
    }

    let decision;
    try {
      decision = await askContentDividend(request, env);
    } catch (error) {
      // Fail open on ContentDividend connectivity problems. A publisher can
      // later choose a stricter failure policy if the architecture requires it.
      decision = {
        decision: "bridge_unavailable",
        mode: "observe",
        allow: true,
        reason: "ContentDividend authorization service could not be reached."
      };
    }

    if (decision.mode === "enforce_ai" && decision.allow !== true) {
      return new Response(JSON.stringify({
        error: "contentdividend_license_required",
        message: "This AI request is not authorized for this publisher URL.",
        licensing: "https://app.contentdividend.com/licensing-marketplace"
      }), {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-contentdividend-decision": String(decision.decision || "deny")
        }
      });
    }

    // Do not forward ContentDividend buyer credentials to the publisher origin.
    const originHeaders = new Headers(request.headers);
    originHeaders.delete("authorization");
    originHeaders.delete("x-contentdividend-license-key");
    const originRequest = new Request(request, { headers: originHeaders });

    const originResponse = await fetch(originRequest);
    const headers = new Headers(originResponse.headers);
    headers.set("x-contentdividend-authorization", String(decision.decision || "observed"));

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers
    });
  }
};
