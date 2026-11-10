import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/database.service', () => ({ DatabaseService: {} }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { charactersStore } = await import('$lib/stores/characters/index.svelte');

const shinobu = {
	createdAt: 1,
	description: 'A young swordswoman with violet eyes. Her hair is tied in a butterfly style.',
	gender: 'female',
	id: 'ai',
	lastModified: 1,
	name: 'Shinobu Kocho',
	personality: 'Calm and graceful. She speaks gently and a little playfully.'
} as DatabaseCharacter;
const wd = {
	createdAt: 1,
	description: 'A traveller who likes tea.',
	gender: 'male',
	id: 'me',
	isUserPersona: true,
	lastModified: 1,
	name: 'wd'
} as DatabaseCharacter;

// Every concept that is named in the context is something the model's reasoning picks up and
// talks about -- so the immersive texts must not contain these words, not even to deny them.
const META =
	/role-?play|pretend|playing|portray|\bAI\b|assistant|\buser\b|persona|\bcharacter\b|performance|language model/i;

beforeEach(() => {
	charactersStore.characters = [shinobu, wd];
	charactersStore.setActiveCharacter('ai');
	charactersStore.setActiveUserPersona('me');
	charactersStore.setImmersiveMode(true);
});

describe('immersive system prompt', () => {
	it('has no roleplay / AI / user vocabulary of its own', () => {
		const block = charactersStore.buildPersonaSystemPromptBlock();
		// the notes written by the person who made the card are theirs; check only our words
		const ours = block
			.replace(shinobu.description!, '')
			.replace(shinobu.personality!, '')
			.replace(wd.description!, '');

		expect(ours).not.toMatch(META);
	});

	it('says who you are and who is in front of you, by name', () => {
		const block = charactersStore.buildPersonaSystemPromptBlock();

		expect(block).toContain('You are Shinobu Kocho (female).');
		expect(block).toContain('The person in front of you is wd (male).');
		expect(block).toContain(shinobu.description);
		expect(block).toContain(shinobu.personality);
	});

	it('tells the model once that third-person notes are about itself', () => {
		expect(charactersStore.buildPersonaSystemPromptBlock()).toContain(
			'every "she", "he", "they" and name in them is you'
		);
	});

	it('roleplay mode keeps its original wording', () => {
		charactersStore.setImmersiveMode(false);

		const block = charactersStore.buildPersonaSystemPromptBlock();

		expect(block).toContain('You are roleplaying as the character "Shinobu Kocho"');
		expect(block).toContain('is roleplaying as "wd"');
	});
});

describe('reasoning seeds', () => {
	it("are first-person, in the character's voice, and name the other person", () => {
		const seeds = charactersStore.buildReasoningSeeds()!;

		expect(seeds.turn.startsWith("I'm Shinobu Kocho.")).toBe(true);
		expect(seeds.turn).toContain('wd just said something to me');
		expect(seeds.afterTool).toContain('for wd');
		expect(seeds.turn).not.toMatch(META);
		expect(seeds.afterTool).not.toMatch(META);
	});

	it('say "they" when no persona is active', () => {
		charactersStore.setActiveUserPersona(undefined);

		expect(charactersStore.buildReasoningSeeds()!.turn).toContain('They just said something to me');
	});

	it('exist only in immersive mode with an active character', () => {
		charactersStore.setImmersiveMode(false);
		expect(charactersStore.buildReasoningSeeds()).toBeUndefined();

		charactersStore.setImmersiveMode(true);
		charactersStore.setActiveCharacter(undefined);
		expect(charactersStore.buildReasoningSeeds()).toBeUndefined();
	});
});

describe('thinking & tools display setting', () => {
	it('defaults to separate blocks and can be switched', () => {
		expect(charactersStore.activityDisplay).toBe('default');

		charactersStore.setActivityDisplay('combined');
		expect(charactersStore.activityDisplay).toBe('combined');

		charactersStore.setActivityDisplay('typing');
		expect(charactersStore.activityDisplay).toBe('typing');
	});
});
