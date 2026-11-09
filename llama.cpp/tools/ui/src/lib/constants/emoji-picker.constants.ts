/**
 * Built-in emoji set for the chat input's emoji picker, so nobody has to
 * copy emojis from a website. Every list is space-separated (not split by
 * code point) so multi-part emojis -- flags, ZWJ sequences, the ones with a
 * variation selector -- stay intact.
 */

export interface EmojiCategory {
	id: string;
	/** Icon shown in the category bar. */
	icon: string;
	title: string;
	emojis: string[];
}

function list(text: string): string[] {
	return text.split(/\s+/).filter(Boolean);
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
	{
		id: 'smileys',
		icon: '😀',
		title: 'Smileys & emotion',
		emojis: list(
			'😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊'
		)
	},
	{
		id: 'people',
		icon: '👋',
		title: 'Hands & people',
		emojis: list(
			'👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 💋 🩸 👶 🧒 👦 👧 🧑 👱 👨 👩 🧔 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🏃 💃 🕺 🕴️ 👯 🧖 🧘 🛀 🛌'
		)
	},
	{
		id: 'hearts',
		icon: '❤️',
		title: 'Hearts & love',
		emojis: list(
			'❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 💍 💐 🌹 🥀 😍 🥰 😘 😻 💑 👩‍❤️‍👨 👨‍❤️‍👨 👩‍❤️‍👩 💏'
		)
	},
	{
		id: 'animals',
		icon: '🐶',
		title: 'Animals & nature',
		emojis: list(
			'🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🕸️ 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🐫 🦒 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🦚 🦜 🦢 🕊️ 🐇 🦝 🦨 🦡 🐿️ 🦔 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🎍 🍃 🍂 🍁 🍄 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ ⛄ 💧 💦 🌊'
		)
	},
	{
		id: 'food',
		icon: '🍎',
		title: 'Food & drink',
		emojis: list(
			'🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🧆 🌮 🌯 🥗 🥘 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥠 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️'
		)
	},
	{
		id: 'activities',
		icon: '⚽',
		title: 'Activities & games',
		emojis: list(
			'⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🏹 🎣 🥊 🥋 🎽 🛹 ⛸️ 🥌 🎿 ⛷️ 🏂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🏄 🏊 🤽 🚣 🧗 🚴 🚵 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩'
		)
	},
	{
		id: 'travel',
		icon: '🚗',
		title: 'Travel & places',
		emojis: list(
			'🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🚧 ⛽ 🚏 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🌃 🌆 🌇 🌉 🌌 🌠 🎆 🎇'
		)
	},
	{
		id: 'objects',
		icon: '💡',
		title: 'Objects',
		emojis: list(
			'⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📷 📹 🎥 📞 ☎️ 📺 📻 🎙️ ⏰ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 💊 💉 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚽 🚿 🛁 🧼 🔑 🗝️ 🚪 🛋️ 🛏️ 🧸 🖼️ 🛍️ 🎁 🎈 🎏 🎀 🎊 🎉 🎎 🏮 ✉️ 📩 📦 🏷️ 📜 📃 📄 📑 📊 📈 📉 📅 📆 📇 📋 📁 📂 🗂️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🔗 📎 📐 📏 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓'
		)
	},
	{
		id: 'symbols',
		icon: '✅',
		title: 'Symbols',
		emojis: list(
			'☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⚛️ ☢️ ☣️ 🆚 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🔞 ❗ ❕ ❓ ❔ ‼️ ⁉️ ⚠️ 🔱 ⚜️ 🔰 ♻️ ✅ ❎ 🌐 💠 🌀 💤 🔔 🔕 🎵 🎶 ➕ ➖ ➗ ✖️ ♾️ 💲 ™️ ©️ ®️ ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 ⬛ ⬜ 🔈 🔉 🔊 📢 📣 💬 💭 🗯️ ♠️ ♣️ ♥️ ♦️ 🃏 🎴 🀄'
		)
	},
	{
		id: 'flags',
		icon: '🏁',
		title: 'Flags',
		emojis: list(
			'🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏴‍☠️ 🇮🇳 🇺🇸 🇬🇧 🇯🇵 🇰🇷 🇨🇳 🇩🇪 🇫🇷 🇮🇹 🇪🇸 🇧🇷 🇨🇦 🇦🇺 🇷🇺 🇲🇽 🇵🇰 🇧🇩 🇳🇵 🇱🇰 🇦🇪 🇸🇦 🇹🇷 🇿🇦 🇳🇬 🇪🇬 🇮🇩 🇸🇬 🇹🇭 🇻🇳 🇵🇭 🇳🇱 🇸🇪 🇨🇭 🇺🇦 🇦🇷'
		)
	}
];

export const RECENT_EMOJIS_LOCALSTORAGE_KEY = 'Knome.recentEmojis';
export const MAX_RECENT_EMOJIS = 24;
