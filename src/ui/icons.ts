/**
 * CRAIL's icons, drawn once in one style: 24-unit boxes, 2.4 strokes in the ink colour,
 * round joins, chunky like the lettering on playground signs. Inline SVG strings, so they
 * can go anywhere text can.
 */

const svg = (body: string, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${body}</svg>`;

/** A charm: a yellow token stamped with a little cube. Yellow means charm, everywhere. */
export const CHARM = svg(
  '<circle cx="12" cy="12" r="9.2" fill="#ffc933" stroke="currentColor" stroke-width="2.4"/>' +
    '<path d="M12 7.2l4.2 2.4v4.8L12 16.8l-4.2-2.4V9.6z" fill="#fff3c4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M7.8 9.6L12 12l4.2-2.4M12 12v4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  'charm',
);

/** The cube, as the logo: the red hero, drawn isometric. */
export const CUBE = svg(
  '<path d="M12 2.6l8.6 4.9v9L12 21.4l-8.6-4.9v-9z" fill="#e8402a" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M3.4 7.5L12 12.4l8.6-4.9M12 12.4v9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M12 12.4l8.6-4.9v9L12 21.4z" fill="#000" opacity=".16"/>',
  'cube',
);

export const MAP = svg(
  '<path d="M3.5 6.2l5.5-2.4 6 2.4 5.5-2.4v14l-5.5 2.4-6-2.4-5.5 2.4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M9 3.8v14M15 6.2v14" stroke="currentColor" stroke-width="2.4"/>',
);

export const SOUND_ON = svg(
  '<path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
);

export const SOUND_OFF = svg(
  '<path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
);

export const CLOSE = svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>');

export const CHEVRON = svg('<path d="M7 9.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>', 'chev');

/** The cult: two hooded heads, in robe red. */
export const CULT = svg(
  '<path d="M3.5 20c.4-3.6 2.4-5.6 5-5.6s4.6 2 5 5.6z" fill="#8e2f33" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M5.4 11.6a3.1 3.4 0 1 1 6.2 0c0 1.9-1.4 3.1-3.1 3.1s-3.1-1.2-3.1-3.1z" fill="#8e2f33" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M11.6 20c.4-3 2.1-4.7 4.4-4.7s4 1.7 4.4 4.7z" fill="#b5474b" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M13.4 12.2a2.7 3 0 1 1 5.4 0c0 1.6-1.2 2.7-2.7 2.7s-2.7-1.1-2.7-2.7z" fill="#b5474b" stroke="currentColor" stroke-width="2"/>',
);

/** A speech bubble, for comments. */
export const COMMENT = svg(
  '<path d="M4 5.5h16v10H11l-4.5 3.8V15.5H4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
);

/** Text with the charm sign (✦) drawn as the charm token. Safe: text goes in as text. */
export function withCharms(el: HTMLElement, text: string): void {
  el.textContent = '';
  text.split('✦').forEach((part, i) => {
    if (i > 0) {
      const t = document.createElement('span');
      t.className = 'token';
      t.innerHTML = CHARM;
      t.setAttribute('role', 'img');
      t.setAttribute('aria-label', 'charm');
      el.append(t);
    }
    if (part) el.append(document.createTextNode(part));
  });
}
