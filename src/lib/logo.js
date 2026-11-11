// The fit+ mark: a glass dumbbell with a white glass plus cut into its lower right, each with a soft
// drop shadow. Same build as the lifestyle+ heart and the shoot+ camera, so the three icons sit
// together on the Home Screen. One drawing feeds the header logo, the loading screen, the app icons in
// public/icons and the icon that's redrawn in the browser when you pick a new logo color.

export const LOGO_COLORS = [
  { id: 'glass', name: 'Glass', hex: '#c8c8cc' },
  { id: 'sunflower', name: 'Sunflower', hex: '#ffcf5c' },
  { id: 'tangerine', name: 'Tangerine', hex: '#ff9f4a' },
  { id: 'coral', name: 'Coral', hex: '#ff6f61' },
  { id: 'rose', name: 'Rose', hex: '#ff86b8' },
  { id: 'lilac', name: 'Lilac', hex: '#bba9ff' },
  { id: 'sky', name: 'Sky', hex: '#7cc4ff' },
  { id: 'mint', name: 'Mint', hex: '#7fdca0' },
];
export const DEFAULT_LOGO = LOGO_COLORS[0].hex;

const valid = (hex) => (/^#[0-9a-f]{6}$/i.test(hex || '') ? hex : DEFAULT_LOGO);

// One outline in a 1024 box: outer plate, inner plate, the bar, then the same on the right.
export const BODY =
  'M196 360H236V340C236 316 248 300 272 300H284C308 300 320 316 320 340V482H704V340C704 316 716 300 740 300H752C776 300 788 316 788 340V360H828C852 360 864 376 864 400V624C864 648 852 664 828 664H788V684C788 708 776 724 752 724H740C716 724 704 708 704 684V542H320V684C320 708 308 724 284 724H272C248 724 236 708 236 684V664H196C172 664 160 648 160 624V400C160 376 172 360 196 360Z';
// The grip knurling: three short lines across the bar.
const KNURL = [446, 512, 578];
// The plus bites the bottom-right corner. A thin cross with a round stroke rounds its corners.
const plusPath = (x, y, arm = 82, half = 12) =>
  `M${x - half} ${y - arm}h${half * 2}v${arm - half}h${arm - half}v${half * 2}h${half - arm}v${arm - half}h${-half * 2}v${half - arm}h${half - arm}v${-half * 2}h${arm - half}z`;
export const PLUS_AT = { x: 812, y: 716 };
export const PLUS = plusPath(PLUS_AT.x, PLUS_AT.y);
// The mark (body plus the plus) is centered on this square in the header and loading screen.
export const MARK_VIEW = '137 132 760 760';

/**
 * SVG markup for the mark.
 *   color:     dumbbell color (any color; the glass shading is laid over it)
 *   bg:        true for app icons (full square near-black tile); false for the in-app logo
 *   id:        prefix so several marks on one page don't share ids
 *   fill:      optional raw fill (the loading screen passes a CSS variable)
 */
export function logoSVG(color, { bg = false, id = 'fp', fill } = {}) {
  const c = fill || valid(color);
  const view = bg ? '0 0 1024 1024' : MARK_VIEW;
  const body = (attrs) => `<path d="${BODY}" ${attrs}/>`;
  const plus = (width, attrs) => `<path d="${PLUS}" stroke-width="${width}" stroke-linejoin="round" ${attrs}/>`;
  // Shift the drawing so the whole mark sits centered on the icon tile.
  const shift = bg ? ' transform="translate(-15 -12)"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="100%" height="100%">
  <defs>
    <linearGradient id="${id}-tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0c"/><stop offset="1" stop-color="#000"/></linearGradient>
    <linearGradient id="${id}-tileRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".25" stop-color="#fff" stop-opacity=".04"/><stop offset=".8" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>
    <linearGradient id="${id}-shade" x1=".15" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
    <linearGradient id="${id}-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".32" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".5" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity=".5"/></linearGradient>
    <linearGradient id="${id}-plus" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#f6f6f8"/><stop offset="1" stop-color="#cdcdd2"/></linearGradient>
    <mask id="${id}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/>
      ${plus(104, 'fill="#000" stroke="#000"')}
    </mask>
    <clipPath id="${id}-bc">${body('')}</clipPath>
    <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="18"/><feOffset dy="16" result="b"/>
      <feFlood flood-color="#000" flood-opacity=".6"/><feComposite in2="b" operator="in" result="s"/>
      <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  ${bg ? `<rect width="1024" height="1024" fill="url(#${id}-tile)"/><rect x="6" y="6" width="1012" height="1012" rx="226" fill="none" stroke="url(#${id}-tileRim)" stroke-width="12"/>` : ''}
  <g${shift}>
  <g class="lg-body" filter="url(#${id}-shadow)"><g mask="url(#${id}-cut)">
    ${body(`style="fill:${c}" opacity=".85"`)}
    <g clip-path="url(#${id}-bc)">
      ${body(`fill="url(#${id}-shade)"`)}
      ${body(`fill="url(#${id}-sheen)"`)}
      ${body(`fill="none" stroke="#000" stroke-opacity=".3" stroke-width="44" transform="translate(0 20)" filter="url(#${id}-soft)"`)}
      ${body(`fill="none" stroke="url(#${id}-rim)" stroke-width="12"`)}
      ${KNURL.map((x) => `<path d="M${x} 492V532" stroke="#fff" stroke-opacity=".22" stroke-width="8" stroke-linecap="round"/>`).join('')}
    </g>
  </g></g>
  <g class="lg-plus" filter="url(#${id}-shadow)">
    ${plus(44, 'fill="#fff" stroke="#fff"')}
    ${plus(32, `fill="url(#${id}-plus)" stroke="url(#${id}-plus)" transform="translate(0 4)"`)}
  </g>
  </g>
</svg>`;
}

/** Draws the app icon to a PNG data URL in the browser (for the live home-screen icon and tab icon). */
export function logoIconPNG(color, size = 180) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSVG(color, { bg: true, id: 'ico' }))}`;
  });
}
