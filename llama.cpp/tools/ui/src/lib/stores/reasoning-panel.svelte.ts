/**
 * reasoningPanelStore - state of the right-side "Reasoning" panel.
 *
 * Clicking a Reasoning block (when Settings > Display > "Open reasoning in a side panel" is on)
 * opens the panel instead of expanding the block inside the chat. The block that owns the panel
 * keeps `content` / `streaming` up to date, so a reasoning that is still being generated streams
 * live into the panel.
 */

class ReasoningPanelStore {
	isOpen = $state(false);
	/** Identifies the reasoning block shown: `${messageId}:${sectionIndex}` */
	ownerKey = $state('');
	content = $state('');
	streaming = $state(false);
	title = $state('Reasoning');

	open(key: string, content: string, streaming: boolean): void {
		this.ownerKey = key;
		this.content = content;
		this.streaming = streaming;
		this.isOpen = true;
	}

	/** Called by the owning block whenever its text changes. */
	sync(key: string, content: string, streaming: boolean): void {
		if (!this.isOpen || this.ownerKey !== key) return;

		this.content = content;
		this.streaming = streaming;
	}

	toggle(key: string, content: string, streaming: boolean): void {
		if (this.isOpen && this.ownerKey === key) this.close();
		else this.open(key, content, streaming);
	}

	close(): void {
		this.isOpen = false;
	}
}

export const reasoningPanelStore = new ReasoningPanelStore();
