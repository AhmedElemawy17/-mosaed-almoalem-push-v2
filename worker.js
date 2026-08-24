import { sendPushNotification } from "@mmmike/web-push/send";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });

async function supabaseFetch(path, env, options = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response("", { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/vapid-public-key") {
      return json({ publicKey: env.VAPID_PUBLIC_KEY });
    }

    if (request.method === "POST" && url.pathname === "/subscribe") {
      const body = await request.json().catch(() => null);

      if (
        !body?.account_code ||
        !body?.student_code ||
        !body?.endpoint ||
        !body?.p256dh ||
        !body?.auth
      ) {
        return json({ ok: false, error: "Missing subscription fields" }, 400);
      }

      const response = await supabaseFetch("push_subscriptions", env, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          account_code: body.account_code,
          student_code: body.student_code,
          endpoint: body.endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        return json({ ok: false, error: await response.text() }, 500);
      }

      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/notify") {
      const body = await request.json().catch(() => null);

      if (!body?.account_code) {
        return json({ ok: false, error: "account_code is required" }, 400);
      }

      const query =
        `push_subscriptions?account_code=eq.${encodeURIComponent(body.account_code)}` +
        `&select=endpoint,p256dh,auth`;

      const response = await supabaseFetch(query, env);

      if (!response.ok) {
        return json({ ok: false, error: await response.text() }, 500);
      }

      const subscriptions = await response.json();

      const payload = {
        title: body.title || "مساعد المعلم",
        body: body.body || "لديك إشعار جديد.",
        icon: body.icon || "/icon-192.png",
        badge: body.badge || "/icon-192.png",
        tag: body.tag || "mosaed-push",
        data: { url: body.url || "/" }
      };

      const vapid = {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT
      };

      const results = [];

      for (const row of subscriptions) {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        };

        try {
          const sent = await sendPushNotification(subscription, payload, vapid);
          results.push({ endpoint: row.endpoint, ok: !!sent });
        } catch (error) {
          results.push({
            endpoint: row.endpoint,
            ok: false,
            error: String(error?.message || error)
          });
        }
      }

      return json({
        ok: true,
        count: results.length,
        results
      });
    }

    return json({ ok: false, error: "Not found" }, 404);
  }
};
