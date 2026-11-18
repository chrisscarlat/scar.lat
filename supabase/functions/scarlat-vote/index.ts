// scar.lat vote collector.
// The site sends a navigator.sendBeacon() with a JSON array of votes (text/plain,
// no auth header possible), so this function is deployed with --no-verify-jwt
// and only accepts requests from the site's own origins.
//
// Location rules:
//  - the visitor's IP comes from cf-connecting-ip, else the FIRST entry of
//    x-forwarded-for, else x-real-ip (never the proxy / edge function's own IP)
//  - networks of cloud / hosting / relay providers (AWS, Google Cloud, Azure,
//    Cloudflare, Akamai, Apple Private Relay, …) → "Unknown (VPN/proxy)"
//  - no city → country only, city left empty; never the ISP / provider name
//  - the IP itself is never stored or logged
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const ORIGINS = new Set(["https://scar.lat", "https://www.scar.lat", "http://localhost:8765"]);
const CLOUD = /amazon|\baws\b|google (cloud|llc)|microsoft|azure|cloudflare|akamai|apple|icloud|private relay|fastly|digitalocean|hetzner|\bovh\b|linode|oracle|alibaba|tencent|vultr|leaseweb|m247|datacamp/i;
const DEBUG = Deno.env.get("SCARLAT_VOTE_DEBUG") === "1"; // only while testing

function pickIp(h: Headers): { ip: string | null; source: string } {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return { ip: cf, source: "cf-connecting-ip" };
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return { ip: xff, source: "x-forwarded-for[0]" };
  const xr = h.get("x-real-ip")?.trim();
  if (xr) return { ip: xr, source: "x-real-ip" };
  return { ip: null, source: "none" };
}

function isPrivate(ip: string) {
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip);
}

function mask(ip: string | null) {
  if (!ip) return null;
  return ip.includes(":") ? ip.split(":").slice(0, 3).join(":") + ":…" : ip.split(".").slice(0, 2).join(".") + ".x.x";
}

type Geo = { country: string | null; country_code: string | null; city: string | null; location: string; via_proxy: boolean; why?: string };

async function locate(ip: string | null): Promise<Geo> {
  const unknown: Geo = { country: null, country_code: null, city: null, location: "Unknown", via_proxy: false };
  if (!ip || isPrivate(ip)) return { ...unknown, why: "no public ip" };
  try {
    const r = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,isp,org,as,asname,hosting,proxy`,
      { signal: AbortSignal.timeout(2500) },
    );
    const g = await r.json();
    if (g.status !== "success") return { ...unknown, why: "lookup failed" };
    const net = [g.isp, g.org, g.as, g.asname].filter(Boolean).join(" | ");
    if (g.hosting || g.proxy || CLOUD.test(net)) {
      return { country: null, country_code: null, city: null, location: "Unknown (VPN/proxy)", via_proxy: true,
        why: `cloud/proxy network (hosting=${g.hosting}, proxy=${g.proxy})` };
    }
    const city = (g.city || "").trim() || null;
    const country = (g.country || "").trim() || null;
    return {
      country, country_code: g.countryCode || null, city,
      location: city && country ? `${city}, ${country}` : (country || "Unknown"),
      via_proxy: false, why: city ? "ok" : "no city → country only",
    };
  } catch (_) {
    return { ...unknown, why: "lookup error" };
  }
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const cors = { "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://scar.lat", "Vary": "Origin" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "content-type" } });
  if (req.method !== "POST") return new Response("method", { status: 405, headers: cors });
  if (origin && !ORIGINS.has(origin)) return new Response("origin", { status: 403, headers: cors });

  const { ip, source } = pickIp(req.headers);

  if (DEBUG && req.headers.get("x-scarlat-debug") === "1") {
    // test only: which header was used (IPs masked) and what the lookup decides.
    // x-scarlat-test-ip lets a test check the cloud/proxy rule with a known IP.
    const testIp = req.headers.get("x-scarlat-test-ip");
    const geo = await locate(testIp || ip);
    const ipHeaders: Record<string, string | null> = {};
    for (const k of ["cf-connecting-ip", "x-forwarded-for", "x-real-ip", "forwarded"]) {
      const v = req.headers.get(k);
      ipHeaders[k] = v ? v.split(",").map((s) => mask(s.trim())).join(", ") : null;
    }
    return Response.json({ picked: source, pickedIp: mask(ip), ipHeaders, headerNames: [...req.headers.keys()].sort(), testIp: mask(testIp), geo }, { headers: cors });
  }

  let body: unknown;
  try { body = JSON.parse(await req.text()); } catch (_) { return new Response("json", { status: 400, headers: cors }); }
  const list = (Array.isArray(body) ? body : [body]).slice(0, 50);
  const geo = await locate(ip);
  const { why: _why, ...place } = geo;
  const rows = list
    .filter((v: any) => v && typeof v.image === "string" && ["like", "dislike", "none"].includes(v.vote))
    .map((v: any) => ({
      image: clip(v.image, 500)!,
      project: clip(v.project, 120),
      vote: v.vote,
      lang: clip(v.lang, 10),
      device: v.device === "mobile" ? "mobile" : "desktop",
      client_ts: typeof v.ts === "string" && !isNaN(Date.parse(v.ts)) ? v.ts : null,
      ...place,
    }));
  if (!rows.length) return new Response("empty", { status: 400, headers: cors });
  const { error } = await sb.from("scarlat_votes").insert(rows);
  if (error) { console.error("insert failed", error.message); return new Response("db", { status: 500, headers: cors }); }
  return new Response(JSON.stringify({ ok: rows.length }), { headers: { ...cors, "content-type": "application/json" } });
});
