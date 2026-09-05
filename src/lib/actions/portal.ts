/** Move a node to `document.body` so overlays escape overflow and stacking. */
export function portal(node: HTMLElement): { destroy: () => void } {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}

export type MenuPlacement = 'auto' | 'above' | 'below';

export type MenuBox = {
	top: number;
	left: number;
	maxHeight: number;
};

/**
 * Pin a fixed menu to a trigger and keep the whole panel on screen.
 * `right`-alignment used to slide wide menus off the left edge (compose footer).
 */
export function menuPosition(
	trigger: HTMLElement | undefined,
	menu?: HTMLElement | undefined,
	prefer: MenuPlacement = 'auto'
): MenuBox {
	const margin = 8;
	const gap = 6;
	const fallbackWidth = 280;
	const fallbackHeight = 280;
	if (!trigger) {
		const viewport = globalThis.window?.innerHeight ?? 600;
		return { top: margin, left: margin, maxHeight: Math.max(120, viewport - margin * 2) };
	}

	const rect = trigger.getBoundingClientRect();
	const width = Math.min(menu?.offsetWidth || fallbackWidth, window.innerWidth - margin * 2);
	const naturalHeight = menu?.offsetHeight || fallbackHeight;

	let left = rect.left;
	if (left + width > window.innerWidth - margin) {
		left = rect.right - width;
	}
	left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

	const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
	const spaceAbove = rect.top - gap - margin;
	let openAbove = spaceBelow < naturalHeight && spaceAbove > spaceBelow;
	if (prefer === 'above') {
		openAbove = spaceAbove >= Math.min(naturalHeight, 120) || spaceAbove > spaceBelow;
	} else if (prefer === 'below') {
		openAbove = false;
	}

	if (openAbove) {
		const maxHeight = Math.max(120, spaceAbove);
		const height = Math.min(naturalHeight, maxHeight);
		return {
			top: Math.max(margin, rect.top - height - gap),
			left,
			maxHeight
		};
	}

	const maxHeight = Math.max(120, spaceBelow);
	return {
		top: rect.bottom + gap,
		left,
		maxHeight
	};
}
