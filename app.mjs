import { config } from "./config.mjs";
import {
	eligibleModels,
	exportRecipe,
	generateImage,
	imageRequest,
	priceLabel,
	recipe,
} from "./core.mjs";
import { PENDING, authorization, callback } from "./auth.mjs";

const $ = (id) => document.getElementById(id);
const preferencesKey = "seedroom.preferences";
let connection;
let models = [];
const history = [];
let selected;
let inFlight;
let saved = {};
const embedded = window.top !== window;

function element(name, text, className) {
	const node = document.createElement(name);
	if (text !== undefined) node.textContent = text;
	if (className) node.className = className;
	return node;
}

function values() {
	return {
		prompt: $("prompt").value,
		style: document.querySelector('input[name="style"]:checked')?.value,
		model: $("model").value,
		size: $("size").value,
		seed: $("seed").value,
	};
}

function saveForm() {
	try {
		sessionStorage.setItem(preferencesKey, JSON.stringify(values()));
	} catch {}
}

function update() {
	const model = models.find((item) => item.name === $("model").value);
	const matches = Boolean(
		connection && model && connection.model === model.name,
	);
	for (const control of $("form").querySelectorAll(
		"input,select,textarea,button",
	))
		control.disabled = Boolean(inFlight);
	$("connect").hidden = embedded || Boolean(connection && matches);
	$("disconnect").hidden = !connection;
	$("standalone").hidden = !embedded;
	$("standalone").href = new URL("./", location.href).href;
	$("connection").textContent = connection
		? "Connected · your Pollen"
		: "Your ideas. Your Pollen.";
	$("generate").textContent = inFlight
		? "Generating one image…"
		: embedded
			? "Open full app to connect"
			: matches
				? "Generate one image ↗"
				: connection
					? "Connect for this model"
					: "Connect to generate";
	$("generate").disabled = Boolean(inFlight) || !model || embedded;
	$("price").textContent = model
		? `${priceLabel(model)} · One image per click. No automatic retries.`
		: "No supported model is selected. Refresh the page to load the live catalog.";
	try {
		$("request").textContent = JSON.stringify(imageRequest(values()), null, 2);
	} catch {
		$("request").textContent =
			"Write a prompt and choose your model, style, canvas, and seed.";
	}
	saveForm();
}

function restore(value) {
	$("prompt").value =
		typeof value.prompt === "string" ? value.prompt : config.defaultPrompt;
	$("seed").value =
		Number.isInteger(Number(value.seed)) && value.seed !== undefined
			? value.seed
			: config.defaultSeed;
	$("size").value = ["768x768", "1024x768", "768x1024"].includes(value.size)
		? value.size
		: "768x768";
	const style = Object.hasOwn(config.styles, value.style)
		? value.style
		: "natural";
	document.querySelector(`input[name="style"][value="${style}"]`).checked =
		true;
	if (models.length)
		$("model").value = models.some((model) => model.name === value.model)
			? value.model
			: models.some((model) => model.name === config.defaultModel)
				? config.defaultModel
				: models[0].name;
}

function show(item) {
	selected = item;
	$("image").src = item.url;
	$("image").alt = item.recipe.prompt;
	$("image").hidden = false;
	$("placeholder").hidden = true;
	$("image-info").hidden = false;
	$("image-number").textContent =
		`EXPERIMENT ${String(history.indexOf(item) + 1).padStart(2, "0")}`;
	$("image-meta").textContent =
		`${config.styles[item.recipe.style].name} · Seed ${item.recipe.seed} · ${item.recipe.model}`;
	$("canvas").style.aspectRatio = item.recipe.size.replace("x", "/");
	for (const button of document.querySelectorAll(".history-card"))
		button.classList.toggle("selected", button.dataset.id === item.id);
}

function renderHistory() {
	$("history").replaceChildren(
		...history.map((item) => {
			const button = element("button", undefined, "history-card");
			button.type = "button";
			button.dataset.id = item.id;
			button.setAttribute(
				"aria-label",
				`Revisit ${config.styles[item.recipe.style].name}, seed ${item.recipe.seed}`,
			);
			const image = element("img");
			image.src = item.url;
			image.alt = item.recipe.prompt;
			button.append(
				image,
				element(
					"span",
					`${config.styles[item.recipe.style].name} · Seed ${item.recipe.seed}`,
					"history-caption",
				),
			);
			button.addEventListener("click", () => {
				if (inFlight) return;
				restore(item.recipe);
				show(item);
				update();
			});
			return button;
		}),
	);
}

function connect() {
	if (!models.some((model) => model.name === $("model").value)) return;
	if (embedded) return;
	$("consent-model").textContent = models.find(
		(model) => model.name === $("model").value,
	).title;
	$("consent-budget").textContent = String(config.defaultBudget);
	$("consent").showModal();
}

$("brand").textContent = config.title;
$("subtitle").textContent = config.subtitle;
document.title = `${config.title} · Visual prompt lab`;
$("template").href = config.templateUrl;
for (const [id, style] of Object.entries(config.styles)) {
	const label = element("label");
	const input = element("input");
	input.type = "radio";
	input.name = "style";
	input.value = id;
	label.append(input, element("span", style.name));
	$("styles").append(label);
}
try {
	saved = JSON.parse(sessionStorage.getItem(preferencesKey) ?? "{}") ?? {};
} catch {}
restore(saved);

const hash = location.hash;
if (
	new URLSearchParams(hash.slice(1)).has("api_key") ||
	new URLSearchParams(hash.slice(1)).has("error")
) {
	window.history.replaceState(
		null,
		"",
		`${location.pathname}${location.search}`,
	);
	let pending;
	try {
		pending = JSON.parse(sessionStorage.getItem(PENDING));
	} catch {}
	sessionStorage.removeItem(PENDING);
	try {
		connection = callback(hash, pending);
		$("message").textContent = "Connected. No image request has been sent.";
	} catch (error) {
		$("message").textContent = error.message;
	}
}

$("form").addEventListener("input", update);
$("form").addEventListener("change", update);
for (const button of document.querySelectorAll("[data-prompt]"))
	button.addEventListener("click", () => {
		$("prompt").value = button.dataset.prompt;
		update();
	});
$("shuffle").addEventListener("click", () => {
	$("seed").value = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483648;
	update();
});
$("connect").addEventListener("click", connect);
$("disconnect").addEventListener("click", () => {
	connection = undefined;
	inFlight?.abort();
	update();
});
$("authorize").addEventListener("click", () => {
	try {
		saveForm();
		const auth = authorization(
			location.href,
			$("model").value,
			config.defaultBudget,
		);
		sessionStorage.setItem(PENDING, JSON.stringify(auth.pending));
		location.assign(auth.url);
	} catch {
		$("consent").close();
		$("message").textContent =
			"Connection could not start. Allow session storage and try again.";
	}
});

$("form").addEventListener("submit", async (event) => {
	event.preventDefault();
	if (inFlight) return;
	if (connection?.model !== $("model").value) {
		connect();
		return;
	}
	let checked;
	try {
		checked = recipe(values());
	} catch (error) {
		$("message").textContent = error.message;
		return;
	}
	const controller = new AbortController();
	inFlight = controller;
	$("working").hidden = false;
	$("message").textContent = "";
	update();
	try {
		const result = await generateImage(
			connection.key,
			checked,
			AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]),
		);
		if (controller.signal.aborted) return;
		const item = {
			id: crypto.randomUUID(),
			recipe: checked,
			url: URL.createObjectURL(result.blob),
			blob: result.blob,
			usage: result.usage,
			created: result.created,
		};
		history.push(item);
		renderHistory();
		show(item);
		$("message").textContent =
			"Image ready. Save it, or change one setting for your next experiment.";
	} catch (error) {
		$("message").textContent = controller.signal.aborted
			? "Request cancelled. A request already received by Pollinations may still be billed."
			: error.name === "TimeoutError"
				? "The request timed out and may still be billed. No retry was sent."
				: error.message;
	} finally {
		inFlight = undefined;
		$("working").hidden = true;
		update();
	}
});

$("image").addEventListener("load", () => {
	if (!selected) return;
	selected.dimensions = {
		width: $("image").naturalWidth,
		height: $("image").naturalHeight,
	};
	$("image-meta").textContent +=
		` · ${selected.dimensions.width} × ${selected.dimensions.height}`;
});

function download(url, filename) {
	const link = element("a");
	link.href = url;
	link.download = filename;
	link.click();
}
$("save").addEventListener("click", () => {
	if (!selected) return;
	const extension = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
	}[selected.blob.type];
	download(selected.url, `seedroom-${selected.recipe.seed}.${extension}`);
});
$("copy").addEventListener("click", async () => {
	if (!selected) return;
	try {
		await navigator.clipboard.writeText(
			JSON.stringify(exportRecipe(selected), null, 2),
		);
		$("message").textContent = "Recipe copied. It contains no key.";
	} catch {
		$("message").textContent =
			"Clipboard unavailable. Use Export recipe to save the same JSON.";
	}
});
$("export").addEventListener("click", () => {
	if (!selected) return;
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(exportRecipe(selected), null, 2)], {
			type: "application/json",
		}),
	);
	download(url, `seedroom-${selected.recipe.seed}.json`);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
});

update();
try {
	const response = await fetch("https://gen.pollinations.ai/image/models");
	if (!response.ok)
		throw new Error(
			"The model catalog could not be loaded. Refresh to try again.",
		);
	models = eligibleModels(await response.json());
	if (!models.length)
		throw new Error(
			"No supported Quest-Pollen image models are available right now.",
		);
	const currentForm = values();
	$("model").replaceChildren(
		...models.map((model) => {
			const option = element(
				"option",
				`${model.title}${model.health?.status === "degraded" ? " · degraded" : ""}`,
			);
			option.value = model.name;
			return option;
		}),
	);
	restore({ ...currentForm, model: saved.model });
	update();
} catch (error) {
	$("message").textContent = error.message;
	update();
}
