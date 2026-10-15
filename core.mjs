import { config } from "./config.mjs";

export function eligibleModels(models) {
	return models.filter(
		(model) =>
			model.category === "image" &&
			model.paid_only === false &&
			!model.community &&
			model.input_modalities?.length === 1 &&
			model.input_modalities[0] === "text" &&
			model.supported_endpoints?.includes("/v1/images/generations"),
	);
}

export function recipe(values) {
	const prompt = String(values.prompt ?? "").trim();
	const seed = Number(values.seed);
	if (!prompt || prompt.length > 2000)
		throw new Error("Write a prompt between 1 and 2,000 characters.");
	if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647)
		throw new Error("Use a whole seed between 0 and 2147483647.");
	if (!Object.hasOwn(config.styles, values.style))
		throw new Error("Choose one of the available styles.");
	if (!["768x768", "1024x768", "768x1024"].includes(values.size))
		throw new Error("Choose one of the available image sizes.");
	if (typeof values.model !== "string" || !values.model)
		throw new Error("Choose an available model.");
	return {
		prompt,
		seed,
		style: values.style,
		size: values.size,
		model: values.model,
	};
}

export function imageRequest(values) {
	const checked = recipe(values);
	return {
		model: checked.model,
		prompt: `${checked.prompt}\n${config.styles[checked.style].prompt}`,
		seed: checked.seed,
		size: checked.size,
		n: 1,
		response_format: "b64_json",
	};
}

export function imageBlob(base64) {
	if (typeof base64 !== "string" || !base64)
		throw new Error("The API returned no image data.");
	const bytes = Uint8Array.from(atob(base64), (character) =>
		character.charCodeAt(0),
	);
	const type =
		bytes[0] === 0xff && bytes[1] === 0xd8
			? "image/jpeg"
			: bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG"
				? "image/png"
				: String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
						String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
					? "image/webp"
					: null;
	if (!type) throw new Error("The API returned an unsupported image format.");
	return new Blob([bytes], { type });
}

export async function generateImage(key, values, signal) {
	const body = imageRequest(values);
	const response = await fetch(
		"https://gen.pollinations.ai/v1/images/generations",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal,
		},
	);
	if (!response.ok) {
		const messages = {
			401: "Your connection has expired. Connect again before generating.",
			402: "Your Pollen balance or this key’s budget is too low. No automatic retry was sent.",
			403: "This connection does not allow the selected model. Connect for that model and try again.",
			429: "The model is busy. Wait a moment, then choose to try again.",
		};
		throw new Error(
			messages[response.status] ??
				`Image generation failed (HTTP ${response.status}). No automatic retry was sent.`,
		);
	}
	const data = await response.json();
	return {
		blob: imageBlob(data.data?.[0]?.b64_json),
		usage: data.usage ?? null,
		created: data.created,
		request: body,
	};
}

export function exportRecipe(item) {
	return {
		app: config.title,
		recipe: recipe(item.recipe),
		request: imageRequest(item.recipe),
		created: item.created ?? null,
		usage: item.usage ?? null,
		dimensions: item.dimensions ?? null,
	};
}

export function priceLabel(model) {
	const rate = Number(model?.pricing?.completionImageTokens);
	return model?.flat_rate && Number.isFinite(rate) && rate >= 0
		? `Listed price: ${rate} Pollen / image`
		: "Token-based price; see the live model card";
}
