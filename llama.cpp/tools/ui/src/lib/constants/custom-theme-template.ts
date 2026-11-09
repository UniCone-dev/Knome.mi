/**
 * Starter for the "Custom CSS" theme. It is written into Settings > General > Custom theme CSS
 * the first time the Custom theme is chosen, and documents the structure to follow.
 */
export const CUSTOM_THEME_TEMPLATE = `/* =====================================================================
   KNOME CUSTOM THEME  --  edit anything, press "Save settings" to apply.
   Everything below is plain CSS. Keep this structure and change the values.
   ===================================================================== */

/* @base dark
   ^ "dark" or "light": which built-in palette your theme starts from.
     (It also decides whether dark: variants of the interface are used.) */


/* ---- 1. COLORS ---------------------------------------------------------
   These variables colour the WHOLE interface. Any CSS colour works
   (#hex, rgb(), oklch()). Start by changing just --background, --foreground
   and --primary, and add the rest as you like. */
:root[data-theme='custom'] {
	--background: #0b1020;           /* page */
	--foreground: #e8ecff;           /* text */
	--card: #121933;                 /* cards, the chat input */
	--card-foreground: #e8ecff;
	--popover: #151d3b;              /* menus and dialogs */
	--popover-foreground: #e8ecff;
	--primary: #6ee7d8;              /* accent: buttons, links, highlights */
	--primary-foreground: #06201d;   /* text on top of --primary */
	--secondary: #1b2547;
	--secondary-foreground: #dfe5ff;
	--muted: #162042;
	--muted-foreground: #9aa6d6;     /* quiet text */
	--accent: #1f2b57;               /* hover backgrounds */
	--accent-foreground: #e8ecff;
	--border: #ffffff1f;
	--input: #ffffff26;
	--ring: #6ee7d880;               /* focus rings */
	--sidebar: #0a0f1f;
	--sidebar-foreground: #e8ecff;
	--sidebar-accent: #172044;
	--sidebar-accent-foreground: #e8ecff;
	--sidebar-border: #ffffff14;
}


/* ---- 2. PARTS OF THE INTERFACE YOU CAN STYLE ---------------------------
   html[data-theme='custom'] is the prefix that keeps this CSS to the
   Custom theme. Selectors you can use:

     aside                                  the sidebar
     [data-slot='input-area']               the chat input box
     button[type='submit'][data-slot='button']   the send button
     [data-slot='button']                   every button
     .chat-message-user-bubble              your messages
     .chat-message-ai-bubble                AI messages (when "AI messages in a bubble" is on)
     .agentic-turn                          the AI's reply block
     .text-gradient-knome                   the "Start a Conversation" headline
     [data-slot='dialog-content']           dialogs (Settings, Characters ...)
     [data-slot='popover-content']          pop-ups and menus
*/
html[data-theme='custom'] [data-slot='input-area'] {
	border-radius: 1.25rem;
	box-shadow: 0 0 0 1px var(--border), 0 12px 40px -16px color-mix(in oklab, var(--primary) 45%, transparent);
}

html[data-theme='custom'] .chat-message-user-bubble {
	background: linear-gradient(135deg, var(--primary), #6aa8ff);
	color: var(--primary-foreground);
}

html[data-theme='custom'] .text-gradient-knome {
	background: linear-gradient(100deg, var(--primary), #8fb4ff, var(--primary));
	background-size: 250% 100%;
	-webkit-background-clip: text;
	background-clip: text;
	-webkit-text-fill-color: transparent;
	animation: my-sheen 8s linear infinite;
}


/* ---- 3. BACKGROUND (animated example) ---------------------------------
   body::before sits behind everything and never blocks clicks.
   Delete this block for a flat background. */
html[data-theme='custom'] body::before {
	content: '';
	position: fixed;
	inset: -20%;
	z-index: -1;
	pointer-events: none;
	background:
		radial-gradient(40% 35% at 20% 15%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%),
		radial-gradient(35% 40% at 85% 85%, #6aa8ff26, transparent 70%);
	animation: my-drift 24s ease-in-out infinite alternate;
}


/* ---- 4. MOTION ---------------------------------------------------------
   Tip: animate only transform and opacity (smooth and light on the GPU).
   Keep the reduced-motion block so people who turn animations off stay happy. */
@keyframes my-drift {
	from { transform: translate3d(0, 0, 0) scale(1); }
	to   { transform: translate3d(3%, 4%, 0) scale(1.08); }
}

@keyframes my-sheen {
	to { background-position: -250% 0; }
}

@media (prefers-reduced-motion: reduce) {
	html[data-theme='custom'] * { animation: none !important; }
}
`;
