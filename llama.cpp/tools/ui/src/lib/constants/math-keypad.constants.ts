/**
 * Token sets for the math input keypad. Each token's `insert` string is
 * spliced directly at the caret -- no `{}` placeholders, since these are
 * meant to be dropped in mid-expression the way a phone math keyboard
 * inserts a superscript digit after whatever you already typed.
 *
 * Powers and roots of ANY size are supported through the custom inputs in
 * the keypad (toSuperscript / toSubscript below), so x¹⁰⁰⁰ or ¹⁰⁰⁰√ is just
 * a typed number away -- the quick buttons only cover the common ones.
 */

export interface MathToken {
	/** What the button shows when it differs from `insert` (e.g. "x²" for the lone superscript "²"). */
	display?: string;
	/** What gets inserted into the message at the caret. */
	insert: string;
	/** Tooltip text. */
	label: string;
}

export interface MathTokenSection {
	title: string;
	tokens: MathToken[];
}

const SUPERSCRIPT_MAP: Record<string, string> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'+': '⁺',
	'-': '⁻',
	'−': '⁻',
	'=': '⁼',
	'(': '⁽',
	')': '⁾',
	a: 'ᵃ',
	b: 'ᵇ',
	c: 'ᶜ',
	d: 'ᵈ',
	e: 'ᵉ',
	f: 'ᶠ',
	g: 'ᵍ',
	h: 'ʰ',
	i: 'ⁱ',
	j: 'ʲ',
	k: 'ᵏ',
	l: 'ˡ',
	m: 'ᵐ',
	n: 'ⁿ',
	o: 'ᵒ',
	p: 'ᵖ',
	r: 'ʳ',
	s: 'ˢ',
	t: 'ᵗ',
	u: 'ᵘ',
	v: 'ᵛ',
	w: 'ʷ',
	x: 'ˣ',
	y: 'ʸ',
	z: 'ᶻ'
};

const SUBSCRIPT_MAP: Record<string, string> = {
	'0': '₀',
	'1': '₁',
	'2': '₂',
	'3': '₃',
	'4': '₄',
	'5': '₅',
	'6': '₆',
	'7': '₇',
	'8': '₈',
	'9': '₉',
	'+': '₊',
	'-': '₋',
	'−': '₋',
	'=': '₌',
	'(': '₍',
	')': '₎',
	a: 'ₐ',
	e: 'ₑ',
	h: 'ₕ',
	i: 'ᵢ',
	j: 'ⱼ',
	k: 'ₖ',
	l: 'ₗ',
	m: 'ₘ',
	n: 'ₙ',
	o: 'ₒ',
	p: 'ₚ',
	r: 'ᵣ',
	s: 'ₛ',
	t: 'ₜ',
	u: 'ᵤ',
	v: 'ᵥ',
	x: 'ₓ'
};

function mapChars(text: string, map: Record<string, string>): string | null {
	const cleaned = text.replace(/\s+/g, '').toLowerCase();

	if (!cleaned) return null;

	let out = '';

	for (const ch of cleaned) {
		const mapped = map[ch];

		if (!mapped) return null;

		out += mapped;
	}

	return out;
}

/**
 * "1000" -> "¹⁰⁰⁰", "-3" -> "⁻³", "n+1" -> "ⁿ⁺¹".
 * Returns null when the text contains a character with no superscript form.
 */
export function toSuperscript(text: string): string | null {
	return mapChars(text, SUPERSCRIPT_MAP);
}

/** "12" -> "₁₂", "n" -> "ₙ". null when a character has no subscript form. */
export function toSubscript(text: string): string | null {
	return mapChars(text, SUBSCRIPT_MAP);
}

/** n-th root glyph for any n: 2 -> "√", 3 -> "∛", 4 -> "∜", 1000 -> "¹⁰⁰⁰√". */
export function rootGlyph(n: string): string | null {
	const cleaned = n.replace(/\s+/g, '');

	if (cleaned === '2') return '√';

	if (cleaned === '3') return '∛';

	if (cleaned === '4') return '∜';

	const sup = toSuperscript(cleaned);

	return sup ? `${sup}√` : null;
}

function tokens(chars: string, labelOf: (c: string) => string): MathToken[] {
	return chars
		.split(' ')
		.filter(Boolean)
		.map((c) => ({ insert: c, label: labelOf(c) }));
}

/** x⁰, x¹, x² ... x¹⁰ -- the quick buttons; anything bigger goes through the custom input. */
const POWERS: MathToken[] = [
	...Array.from({ length: 11 }, (_, i) => {
		const sup = toSuperscript(String(i)) as string;

		return { display: `x${sup}`, insert: sup, label: `x${sup}` };
	}),
	{ display: 'x⁻¹', insert: '⁻¹', label: 'x⁻¹ Inverse' },
	{ display: 'xⁿ', insert: 'ⁿ', label: 'xⁿ' },
	{ display: 'aˣ', insert: 'ˣ', label: 'aˣ' },
	{ display: 'x⁻', insert: '⁻', label: 'Superscript minus' },
	{ display: 'x⁺', insert: '⁺', label: 'Superscript plus' },
	{ display: 'x⁽', insert: '⁽', label: 'Superscript (' },
	{ display: 'x⁾', insert: '⁾', label: 'Superscript )' }
];

/** √, ∛, ∜, then ⁵√ ... ¹⁰√ -- bigger roots go through the custom input. */
const ROOTS: MathToken[] = [
	{ insert: '√', label: '√ Square root' },
	{ insert: '∛', label: '∛ Cube root' },
	{ insert: '∜', label: '∜ 4th root' },
	...Array.from({ length: 6 }, (_, i) => {
		const n = i + 5;
		const glyph = rootGlyph(String(n)) as string;

		return { insert: glyph, label: `${glyph} ${n}th root` };
	}),
	{ insert: 'ⁿ√', label: 'ⁿ√ n-th root' }
];

const SUBSCRIPTS: MathToken[] = [
	...Array.from({ length: 10 }, (_, i) => {
		const sub = toSubscript(String(i)) as string;

		return { display: `x${sub}`, insert: sub, label: `x${sub}` };
	}),
	{ display: 'xₙ', insert: 'ₙ', label: 'xₙ' },
	{ display: 'xᵢ', insert: 'ᵢ', label: 'xᵢ' },
	{ display: 'x₊', insert: '₊', label: 'Subscript plus' },
	{ display: 'x₋', insert: '₋', label: 'Subscript minus' }
];

const FRACTIONS = tokens('½ ⅓ ⅔ ¼ ¾ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅛ ⅜ ⅝ ⅞ ⁄', (c) => `${c} Fraction`);

const OPERATORS: MathToken[] = [
	{ insert: '±', label: '± Plus/minus' },
	{ insert: '∓', label: '∓ Minus/plus' },
	{ insert: '×', label: '× Multiply' },
	{ insert: '÷', label: '÷ Divide' },
	{ insert: '·', label: '· Dot' },
	{ insert: '∗', label: '∗ Asterisk operator' },
	{ insert: '∘', label: '∘ Composition' },
	{ insert: '−', label: '− Minus' },
	{ insert: '=', label: '= Equals' },
	{ insert: '≈', label: '≈ Approx.' },
	{ insert: '≠', label: '≠ Not equal' },
	{ insert: '≡', label: '≡ Identical' },
	{ insert: '≅', label: '≅ Congruent' },
	{ insert: '∼', label: '∼ Similar' },
	{ insert: '∝', label: '∝ Proportional' },
	{ insert: '≤', label: '≤ Less/equal' },
	{ insert: '≥', label: '≥ Greater/equal' },
	{ insert: '≪', label: '≪ Much less' },
	{ insert: '≫', label: '≫ Much greater' },
	{ insert: '<', label: '< Less' },
	{ insert: '>', label: '> Greater' },
	{ insert: '%', label: '% Percent' },
	{ insert: '‰', label: '‰ Per mille' },
	{ insert: '!', label: '! Factorial' },
	{ insert: '°', label: '° Degree' },
	{ insert: '′', label: '′ Prime' },
	{ insert: '″', label: '″ Double prime' },
	{ insert: '|', label: '| Absolute value' },
	{ insert: '‖', label: '‖ Norm' },
	{ insert: '∞', label: '∞ Infinity' }
];

const CALCULUS = tokens('∫ ∬ ∭ ∮ ∂ ∇ ∑ ∏ ∐ Δ δ ε ℓ ℯ ℏ ∆ lim', (c) => `${c}`);

const SETS_LOGIC = tokens(
	'∈ ∉ ∋ ∅ ∪ ∩ ⊂ ⊃ ⊆ ⊇ ⊄ ∖ ∀ ∃ ∄ ¬ ∧ ∨ ⊕ ⊗ ⊢ ⊨ ∴ ∵ ℕ ℤ ℚ ℝ ℂ ℙ',
	(c) => `${c}`
);

const GEOMETRY = tokens('∠ ⊥ ∥ ∦ △ □ ○ ◇ ⌊ ⌋ ⌈ ⌉ ⟨ ⟩ ⟦ ⟧ ∟ ⌀ ⊙', (c) => `${c}`);

const ARROWS = tokens('→ ← ↔ ↑ ↓ ⇒ ⇐ ⇔ ↦ ⟶ ⟵ ⟷ ↗ ↘ ↩ ⇌', (c) => `${c}`);

const GREEK = tokens(
	'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω ϕ ϑ ϰ ϱ ς',
	(c) => `${c} Greek`
);

const OTHER = tokens('µ Å ℃ ℉ ℮ ✓ ✗ ※ ∎ ■ ★ ☆ ♪', (c) => `${c}`);

export const MATH_KEYPAD_SECTIONS: MathTokenSection[] = [
	{ title: 'Powers', tokens: POWERS },
	{ title: 'Roots', tokens: ROOTS },
	{ title: 'Subscripts', tokens: SUBSCRIPTS },
	{ title: 'Fractions', tokens: FRACTIONS },
	{ title: 'Operators & comparison', tokens: OPERATORS },
	{ title: 'Calculus & constants', tokens: CALCULUS },
	{ title: 'Sets & logic', tokens: SETS_LOGIC },
	{ title: 'Geometry', tokens: GEOMETRY },
	{ title: 'Arrows', tokens: ARROWS },
	{ title: 'Greek letters', tokens: GREEK },
	{ title: 'Other', tokens: OTHER }
];
