/**
 * Origami visitor proxy, reached through the /_ov/:path rewrite in next.config.ts.
 *
 * Forwards o.js, e and identify to Origami with the visitor IP and the secret
 * key attached server-side (company-level only, never the person). Anything
 * else is a 404: Origami's /v1/s accepts deletions and this proxy carries the
 * secret key, so it must never forward wholesale.
 *
 * This is a route handler, not middleware, on purpose: the deploy runs
 * `vercel pull` + `vercel build` in CI, which never receives Sensitive env
 * vars, so middleware saw ORIGAMI_VISITORS_SECRET_KEY as empty. Functions get
 * it at runtime.
 */
const ALLOWED = new Set(["o.js", "e", "identify"]);

async function proxy(req: Request, { params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  if (!ALLOWED.has(path)) return new Response(null, { status: 404 });

  // Vercel's edge overwrites x-real-ip / x-forwarded-for, so the browser cannot spoof them.
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";

  const headers = new Headers();
  for (const name of ["user-agent", "origin", "referer", "content-type", "accept"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const k = process.env.ORIGAMI_VISITORS_SECRET_KEY ?? ""; console.log(`[origami-key-check] fn ${path} VERCEL_ENV=${process.env.VERCEL_ENV} ANTHROPIC=${(process.env.ANTHROPIC_API_KEY ?? "").length} ORIGAMI=${k.length} sk=${k.startsWith("og_sk_")}`); // TEMP
  headers.set("X-Origami-Client-IP", ip);
  headers.set("Authorization", `Bearer ${process.env.ORIGAMI_VISITORS_SECRET_KEY ?? ""}`);

  const search = new URL(req.url).search;
  const upstream = await fetch(`https://origami-web-visitors.com/v1/${path}${search}`, {
    method: req.method,
    headers,
    body: req.method === "POST" ? await req.arrayBuffer() : undefined,
    cache: "no-store",
  });

  // Never pass upstream cookies back to the browser.
  const out = new Headers(upstream.headers);
  out.delete("set-cookie");
  out.delete("content-encoding");
  out.delete("content-length");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const dynamic = "force-dynamic";
export { proxy as GET, proxy as POST };
