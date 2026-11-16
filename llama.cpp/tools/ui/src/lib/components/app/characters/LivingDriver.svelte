<script lang="ts">
	// Headless: watches the chat and tells the shared player what the character should be doing:
	// thinking -> speaking -> feeling -> idle.
	import { onDestroy } from 'svelte';
	import { chatStore, conversationsStore } from '$lib/stores';
	import { livingStore } from '$lib/stores/living.svelte';
	import { lastEmotionTag, stripEmotionTags } from '$lib/utils/emotion-tags';

	const player = livingStore.player;

	let wasBusy = false;
	let wasSpeaking = false;
	let lastEmotion: string | undefined;

	$effect(() => {
		player.setEmotions(livingStore.character?.emotions);
	});

	$effect(() => {
		const convId = conversationsStore.activeConversation?.id ?? '';
		const busy = chatStore.isLoading || chatStore.isStreaming();
		const response = chatStore.chatStreamingStates.get(convId)?.response ?? '';
		const visibleText = stripEmotionTags(response).trim().length > 0;
		const tag = lastEmotionTag(response);

		if (busy && !wasBusy) {
			lastEmotion = undefined;
			wasSpeaking = false;
		}

		wasBusy = busy;

		if (tag) lastEmotion = tag;

		if (!busy) {
			if (wasSpeaking && lastEmotion) player.setTarget({ kind: 'feeling', emotion: lastEmotion });
			else player.setTarget({ kind: 'idle' });

			wasSpeaking = false;
		} else if (!visibleText) {
			player.setTarget({ kind: 'thinking' });
		} else {
			wasSpeaking = true;
			player.setTarget({ kind: 'speaking', emotion: lastEmotion });
		}
	});

	onDestroy(() => player.setTarget({ kind: 'idle' }));
</script>
