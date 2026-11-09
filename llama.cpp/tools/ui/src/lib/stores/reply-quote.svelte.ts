/**
 * replyQuoteStore - Holds a piece of text the user selected from a message
 * and chose to "Reply" to, until it's either sent (prepended as a quote to
 * their next message) or dismissed. Cross-component: set from ChatMessages
 * (on selection), consumed and cleared from ChatForm (on submit/dismiss).
 */

class ReplyQuoteStore {
	text = $state<string | null>(null);

	set(text: string): void {
		this.text = text;
	}

	clear(): void {
		this.text = null;
	}
}

export const replyQuoteStore = new ReplyQuoteStore();
