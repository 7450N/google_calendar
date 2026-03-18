// ─────────────────────────────────────────────────
// Cloudflare Worker — Google Calendar Invite
// ─────────────────────────────────────────────────
// Environment variables (set via wrangler secret):
//   GOOGLE_SERVICE_ACCOUNT_JSON  — full JSON key file content
//
// Command:
//   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
//   (paste the entire JSON key file content)

// ── CONFIG — UPDATE THESE ──
const CALENDAR_ID = "your.gmail@gmail.com"; // Your Gmail (calendar owner)
const HER_EMAIL = "her@email.com";          // Her email
const YOUR_NAME = "Jason";
const DATE_TITLE = "Our Date 💕";
const DATE_LOCATION = "TBD";
const TIMEZONE = "Asia/Singapore";

// ── Allowed origin for CORS (your GitHub Pages URL) ──
const ALLOWED_ORIGIN = "https://yourusername.github.io";

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      const { date, time } = await request.json();

      if (!date || !time) {
        return jsonResponse({ error: "Missing date or time" }, 400);
      }

      // Parse service account credentials
      const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      // Get OAuth2 access token using service account
      const accessToken = await getAccessToken(serviceAccount);

      // Build the calendar event
      const startDateTime = `${date}T${time}:00`;
      const endDate = new Date(`${startDateTime}`);
      endDate.setHours(endDate.getHours() + 2); // 2 hour date
      const endDateTime = endDate.toISOString().slice(0, 19);

      const event = {
        summary: DATE_TITLE,
        location: DATE_LOCATION,
        description: `A date with ${YOUR_NAME} 💕\n\nShe said yes! 🥰`,
        start: {
          dateTime: startDateTime,
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: endDateTime,
          timeZone: TIMEZONE,
        },
        attendees: [
          { email: HER_EMAIL },
          { email: CALENDAR_ID },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 60 },
            { method: "email", minutes: 24 * 60 },
          ],
        },
      };

      // Create event via Google Calendar API
      // sendUpdates: "all" → Google sends the invite email automatically
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const calData = await calRes.json();

      if (!calRes.ok) {
        console.error("Google Calendar API error:", JSON.stringify(calData));
        return jsonResponse({ error: "Failed to create calendar event", details: calData.error?.message }, 500);
      }

      return jsonResponse({
        success: true,
        eventId: calData.id,
        htmlLink: calData.htmlLink,
      });
    } catch (err) {
      console.error("Worker error:", err.message, err.stack);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
};

// ─────────────────────────────────────────────────
// Google OAuth2 — Service Account JWT → Access Token
// ─────────────────────────────────────────────────
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  // JWT Header
  const header = { alg: "RS256", typ: "JWT" };

  // JWT Claim Set
  // NOTE: "sub" field is removed because domain-wide delegation
  // is not available on personal Gmail accounts.
  // The service account acts as itself — your calendar must be
  // shared with the service account email for this to work.
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Build JWT
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaimSet = base64url(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  // Import private key and sign
  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64url(signature);
  const jwt = `${signatureInput}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

// ── Crypto helpers ──
async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(input) {
  let str;
  if (typeof input === "string") {
    str = btoa(input);
  } else {
    // ArrayBuffer
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Helpers ──
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
