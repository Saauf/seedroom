export const PENDING = "seedroom.authorization";

export function authorization(href, model, budget) {
	const url = new URL(href);
	const redirect = new URL("./", url).href;
	const state = crypto.randomUUID();
	const pending = { state, model, createdAt: Date.now() };
	const params = new URLSearchParams({
		redirect_uri: redirect,
		state,
		models: model,
		scope: "",
		expiry: "1",
		budget: String(budget),
	});
	return { pending, url: `https://enter.pollinations.ai/authorize?${params}` };
}

export function callback(fragment, pending) {
	const params = new URLSearchParams(fragment.replace(/^#/, ""));
	if (!params.has("api_key") && !params.has("error")) return null;
	if (
		!pending ||
		params.get("state") !== pending.state ||
		Date.now() - pending.createdAt > 600000 ||
		pending.createdAt > Date.now()
	) {
		throw new Error(
			"This connection could not be verified. Start again from this app.",
		);
	}
	if (params.has("error"))
		throw new Error("Connection cancelled. No image request was sent.");
	const key = params.get("api_key");
	if (!key?.startsWith("sk_"))
		throw new Error("No usable key was returned. Connect again.");
	return { key, model: pending.model };
}
