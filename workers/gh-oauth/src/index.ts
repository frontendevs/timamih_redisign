export interface Env {
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	EDITOR_ORIGIN: string;
}

interface GhTokenResponse {
	access_token?: string;
	error?: string;
	error_description?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname !== "/callback") {
			return new Response("Not found", { status: 404 });
		}

		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state") ?? "";

		if (!code) {
			return new Response("Missing OAuth code", { status: 400 });
		}

		const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify({
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				code,
			}),
		});

		if (!tokenResp.ok) {
			return new Response("GitHub token exchange failed", { status: 502 });
		}

		const data = (await tokenResp.json()) as GhTokenResponse;

		if (!data.access_token) {
			const msg = data.error_description ?? data.error ?? "unknown";
			return new Response(`GitHub OAuth error: ${msg}`, { status: 400 });
		}

		// HTTP redirects strip fragments, so use a JS redirect to preserve the hash.
		// NOTE: avoid new URL("/edit/", base) — absolute path ignores base's pathname.
		const origin = env.EDITOR_ORIGIN.replace(/\/$/, "");
		const target = `${origin}/edit/#gh_token=${encodeURIComponent(data.access_token)}&state=${encodeURIComponent(state)}`;

		return new Response(
			`<!DOCTYPE html><html><head><meta charset="utf-8"><script>location.replace(${JSON.stringify(target)})</` +
				`script></head><body>Redirecting…</body></html>`,
			{ headers: { "Content-Type": "text/html;charset=UTF-8" } },
		);
	},
};
