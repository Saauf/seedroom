export const config = {
	title: "Seedroom",
	subtitle: "A small space for visual experiments.",
	defaultModel: "tongyi-mai/z-image-turbo",
	defaultPrompt:
		"A tiny glass greenhouse floating above the clouds, wildflowers inside, soft morning sunlight",
	defaultSeed: 48271,
	defaultBudget: 0.1,
	templateUrl: "https://huggingface.co/spaces/Saauf/seedroom",
	styles: {
		natural: {
			name: "Natural",
			prompt: "Soft natural light, thoughtful composition, fine detail.",
		},
		film: {
			name: "35mm film",
			prompt:
				"35mm analog photography, gentle film grain, warm highlights, subtle halation.",
		},
		paper: {
			name: "Paper world",
			prompt:
				"Handmade layered paper diorama, visible paper texture, soft studio shadows.",
		},
		clay: {
			name: "Clay studio",
			prompt:
				"Tactile miniature clay sculpture, handcrafted details, soft studio lighting.",
		},
		editorial: {
			name: "Editorial",
			prompt:
				"Clean editorial illustration, bold simple shapes, a restrained color palette.",
		},
	},
};
