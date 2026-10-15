import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { config } from "../config.mjs";
import {
	eligibleModels,
	exportRecipe,
	generateImage,
	imageBlob,
	imageRequest,
	priceLabel,
	recipe,
} from "../core.mjs";
import { authorization, callback } from "../auth.mjs";

const values = {
	prompt: "A greenhouse above the clouds",
	style: "paper",
	seed: 42,
	model: config.defaultModel,
	size: "768x768",
};
const png =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const model = {
	name: config.defaultModel,
	title: "Test model",
	category: "image",
	paid_only: false,
	community: false,
	input_modalities: ["text"],
	supported_endpoints: ["/v1/images/generations"],
};

test("catalog eligibility uses structured modality, endpoint and billing fields", () => {
	assert.deepEqual(
		eligibleModels([
			model,
			{ ...model, paid_only: true },
			{ ...model, community: true },
			{ ...model, input_modalities: ["text", "image"] },
			{ ...model, supported_endpoints: [] },
		]),
		[model],
	);
});

test("request preserves a seed, uses one image, and keeps prompts out of the URL", () => {
	const body = imageRequest(values);
	assert.deepEqual(body, {
		model: config.defaultModel,
		prompt: `${values.prompt}\n${config.styles.paper.prompt}`,
		seed: 42,
		size: "768x768",
		n: 1,
		response_format: "b64_json",
	});
	assert.equal(imageRequest({ ...values, style: "film" }).seed, 42);
	assert.notEqual(
		imageRequest({ ...values, style: "film" }).prompt,
		body.prompt,
	);
});

test("invalid prompt, seed, style, model and size fail before sending a request", () => {
	for (const invalid of [
		{ prompt: " " },
		{ prompt: "x".repeat(2001) },
		{ seed: 1.5 },
		{ seed: -1 },
		{ seed: 2147483648 },
		{ style: "__proto__" },
		{ style: "unknown" },
		{ model: "" },
		{ size: "0x0" },
	])
		assert.throws(() => recipe({ ...values, ...invalid }));
});

test("image bytes determine the download MIME instead of assuming PNG", async () => {
	assert.equal(imageBlob(png).type, "image/png");
	assert.equal(
		imageBlob(Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64")).type,
		"image/jpeg",
	);
	assert.throws(
		() => imageBlob(Buffer.from("<script>bad</script>").toString("base64")),
		/unsupported/,
	);
	assert.throws(() => imageBlob(""), /no image/);
});

test("a real HTTP fixture receives the native body and Bearer key, with no key in its URL", async () => {
	const received = [];
	const server = createServer(async (req, res) => {
		let body = "";
		for await (const chunk of req) body += chunk;
		received.push({
			url: req.url,
			key: req.headers.authorization,
			body: JSON.parse(body),
		});
		res.setHeader("content-type", "application/json");
		res.end(
			JSON.stringify({
				created: 1234,
				data: [{ b64_json: png }],
				usage: { output_tokens: 1 },
			}),
		);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const nativeFetch = globalThis.fetch;
	const interception = mock.method(globalThis, "fetch", (url, init) => {
		assert.equal(url, "https://gen.pollinations.ai/v1/images/generations");
		return nativeFetch(
			`http://127.0.0.1:${server.address().port}/v1/images/generations`,
			init,
		);
	});
	try {
		const result = await generateImage("test-only", values);
		assert.equal(result.blob.type, "image/png");
		assert.deepEqual(result.usage, { output_tokens: 1 });
		assert.deepEqual(received, [
			{
				url: "/v1/images/generations",
				key: "Bearer test-only",
				body: imageRequest(values),
			},
		]);
	} finally {
		interception.mock.restore();
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	}
});

for (const status of [401, 402, 403, 429, 500])
	test(`HTTP ${status} does not trigger retries or a fallback model`, async () => {
		const fetch = mock.method(
			globalThis,
			"fetch",
			async () => new Response("{}", { status }),
		);
		try {
			await assert.rejects(generateImage("test-only", values));
			assert.equal(fetch.mock.callCount(), 1);
		} finally {
			fetch.mock.restore();
		}
	});

test("original and duplicated Spaces authorize their own origin without a shared app key", () => {
	for (const host of [
		"https://saauf-seedroom.static.hf.space/",
		"https://another-builder-copy.static.hf.space/",
	]) {
		const auth = authorization(
			`${host}?ignored=value#studio`,
			config.defaultModel,
			0.005,
		);
		const params = new URL(auth.url).searchParams;
		assert.equal(params.get("redirect_uri"), host);
		assert.equal(params.get("models"), config.defaultModel);
		assert.equal(params.get("scope"), "");
		assert.equal(params.get("expiry"), "1");
		assert.equal(params.get("budget"), "0.005");
		assert.equal(params.has("client_id"), false);
		assert.notEqual(
			auth.pending.state,
			authorization(host, config.defaultModel, 0.005).pending.state,
		);
	}
});

test("callback accepts a state-bound key and rejects mismatches, stale states and denial", () => {
	const { pending } = authorization(
		"https://copy.static.hf.space/",
		config.defaultModel,
		0.005,
	);
	assert.deepEqual(
		callback(`#api_key=sk_test-only&state=${pending.state}`, pending),
		{ key: "sk_test-only", model: config.defaultModel },
	);
	assert.equal(callback("#studio", pending), null);
	assert.throws(
		() => callback("#api_key=sk_test-only&state=wrong", pending),
		/verified/,
	);
	assert.throws(
		() =>
			callback(`#api_key=sk_test-only&state=${pending.state}`, {
				...pending,
				createdAt: Date.now() - 600001,
			}),
		/verified/,
	);
	assert.throws(
		() => callback(`#error=access_denied&state=${pending.state}`, pending),
		/cancelled/,
	);
	assert.throws(
		() => callback(`#api_key=invalid&state=${pending.state}`, pending),
		/usable/,
	);
});

test("flat image pricing is per image, never mislabeled as a per-token rate", () => {
	assert.equal(
		priceLabel({
			flat_rate: true,
			pricing: { completionImageTokens: "0.004" },
		}),
		"Listed price: 0.004 Pollen / image",
	);
	assert.match(
		priceLabel({
			flat_rate: false,
			pricing: { completionImageTokens: "0.00001" },
		}),
		/Token-based/,
	);
});

test("recipe export excludes bearer credentials, authorizations and object URLs", () => {
	const data = exportRecipe({
		recipe: values,
		key: "secret-marker",
		url: "blob:secret-marker",
		created: 1234,
		usage: { output_tokens: 1 },
	});
	assert.doesNotMatch(JSON.stringify(data), /secret-marker|Bearer|api_key/);
	assert.deepEqual(data.request, imageRequest(values));
	assert.equal(data.created, 1234);
});
