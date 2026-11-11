<script lang="ts">
	// Ambient particle field for the empty-chat welcome screen.
	//
	// - Dark/Light/System: a gentle, subtle orbiting drift (low particle
	//   count, low opacity) -- ambience without distraction.
	// - Nova theme: a denser, more animated field where particles swim
	//   across the screen in loose schools (drifting horizontally with a
	//   fish-tail-like vertical undulation), in the theme's exact accent
	//   blue.
	//
	// Colors are read from the live CSS variables, so this automatically
	// matches whichever theme is active without any extra config. Canvas
	// 2D (not WebGL), particle count capped for performance, and the
	// animation pauses whenever the tab isn't visible.

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let raf = 0;

	interface Particle {
		x: number;
		y: number;
		lane: number;
		dir: 1 | -1;
		speed: number;
		size: number;
		opacity: number;
		phase: number;
		// orbit-mode fields (dark/light)
		angle: number;
		radius: number;
	}

	// Paper and Slate are the lightweight themes: no particle canvas at all.
	// Same when a custom wallpaper (Settings > Appearance) has replaced the theme background.
	function isMinimal(): boolean {
		const theme = document.documentElement.getAttribute('data-theme');

		if (document.documentElement.hasAttribute('data-appearance-hide-theme')) return true;

		return (
			theme === 'paper' ||
			theme === 'slate' ||
			theme === 'japan' ||
			theme === 'messenger' ||
			theme === 'pastel' ||
			theme === 'custom'
		);
	}

	function isNova(): boolean {
		return document.documentElement.getAttribute('data-theme') === 'nova';
	}

	function makeParticles(width: number, height: number, nova: boolean): Particle[] {
		const particles: Particle[] = [];
		const budget = nova ? 7000 : 11000;
		const cap = nova ? 160 : 110;
		const count = Math.min(cap, Math.floor((width * height) / budget));
		const cx = width / 2;
		const cy = height / 2;

		for (let i = 0; i < count; i++) {
			const side: -1 | 1 = i % 2 === 0 ? -1 : 1;

			if (nova) {
				particles.push({
					dir: Math.random() > 0.5 ? 1 : -1,
					lane: Math.random() * height,
					opacity: 0.25 + Math.random() * 0.55,
					phase: Math.random() * Math.PI * 2,
					size: 1.6 + Math.random() * 2.6,
					speed: 0.4 + Math.random() * 0.9,
					x: Math.random() * width,
					y: 0,
					angle: 0,
					radius: 0
				});
			} else {
				const spread = 0.55 + Math.random() * 0.4;

				particles.push({
					angle: Math.random() * Math.PI * 2,
					radius: (Math.min(width, height) * spread) / 2,
					opacity: 0.12 + Math.random() * 0.35,
					phase: 0,
					size: 1.4 + Math.random() * 2,
					speed: 0.05 + Math.random() * 0.1,
					x: cx + side * width * 0.18,
					y: cy + (Math.random() - 0.5) * height * 0.6,
					dir: 1,
					lane: 0
				});
			}
		}

		return particles;
	}

	$effect(() => {
		const canvas = canvasEl;

		if (!canvas) return;

		const ctx = canvas.getContext('2d');

		if (!ctx) return;

		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

		let width = 0;
		let height = 0;
		let particles: Particle[] = [];
		let nova = isNova();
		let paused = document.hidden;

		const styles = getComputedStyle(document.documentElement);
		const color = styles.getPropertyValue('--primary').trim() || 'oklch(0.6 0.2 290)';

		function resize() {
			const rect = canvas!.parentElement?.getBoundingClientRect();

			width = rect?.width ?? window.innerWidth;
			height = rect?.height ?? window.innerHeight;
			canvas!.width = width * dpr;
			canvas!.height = height * dpr;
			canvas!.style.width = `${width}px`;
			canvas!.style.height = `${height}px`;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			nova = isNova();
			particles = makeParticles(width, height, nova);
		}

		resize();

		const onResize = () => resize();
		const onVisibility = () => {
			paused = document.hidden;
			if (!paused) frame();
		};

		window.addEventListener('resize', onResize);
		document.addEventListener('visibilitychange', onVisibility);

		// switching theme at runtime: stop the loop for Paper/Slate, restart it otherwise
		const themeObserver = new MutationObserver(() => {
			cancelAnimationFrame(raf);
			resize();
			frame();
		});

		themeObserver.observe(document.documentElement, {
			attributeFilter: ['data-theme', 'data-appearance-hide-theme'],
			attributes: true
		});

		let t = 0;

		function frame() {
			if (paused) return;

			if (isMinimal()) {
				ctx!.clearRect(0, 0, width, height);

				return;
			}

			ctx!.clearRect(0, 0, width, height);
			ctx!.fillStyle = color;

			for (const p of particles) {
				let x: number;
				let y: number;

				if (nova) {
					// Swim horizontally, tail undulating up/down like a fish.
					p.x += p.dir * p.speed * (reduceMotion ? 0 : 1);
					if (p.x > width + 20) p.x = -20;
					if (p.x < -20) p.x = width + 20;

					x = p.x;
					y = p.lane + Math.sin(t * 1.6 + p.phase) * 10;
				} else {
					// Gentle orbit drift around a fixed anchor point (p.x, p.y).
					const wobble = Math.sin(t * p.speed + p.angle) * (p.radius * 0.12);
					const orbitAngle = p.angle + t * p.speed * 0.15;

					x = p.x + Math.cos(orbitAngle) * (p.radius * 0.25) + wobble;
					y = p.y + Math.sin(orbitAngle) * (p.radius * 0.18);
				}

				ctx!.beginPath();
				ctx!.globalAlpha =
					p.opacity * (0.7 + 0.3 * Math.sin(t * (nova ? 2.2 : p.speed * 2) + (p.phase || p.angle)));
				ctx!.roundRect(x, y, p.size * 2.4, p.size, p.size / 2);
				ctx!.fill();
			}

			t += reduceMotion ? 0.004 : nova ? 0.03 : 0.02;
			raf = requestAnimationFrame(frame);
		}

		frame();

		return () => {
			window.removeEventListener('resize', onResize);
			document.removeEventListener('visibilitychange', onVisibility);
			themeObserver.disconnect();
			cancelAnimationFrame(raf);
		};
	});
</script>

<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
	<canvas bind:this={canvasEl}></canvas>
</div>
