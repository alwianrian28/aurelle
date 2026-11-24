/**
 * Icons for the header, product cards, service blocks, dialogs and footer.
 * Brand-supplied icons are PNG assets painted through a CSS mask, so they follow
 * `currentColor` (hover inversions keep working); the rest are 1.5px line drawings.
 */
const ASSET_ICONS = {
  heart: '/media/icons/heart.png',
  whatsapp: '/media/icons/whatsapp.png',
  instagram: '/media/icons/instagram.png',
  tiktok: '/media/icons/tiktok.png',
  mail: '/media/icons/mail.png',
  delivery: '/media/icons/delivery.png',
  authentic: '/media/icons/certificate.png',
  warranty: '/media/icons/warranty.png',
  returns: '/media/icons/returns.png',
} as const;

type AssetIconName = keyof typeof ASSET_ICONS;
type DrawnIconName =
  | 'close' | 'arrowUp'
  | 'wearing' | 'cleaning' | 'storing';
export type IconName = AssetIconName | DrawnIconName;

const PATHS: Record<DrawnIconName, React.ReactNode> = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrowUp: <path d="M12 19V6M7 11l5-5 5 5" />,
  wearing: <><circle cx="12" cy="15" r="5" /><path d="M10 6.5h4l-1 3.5h-2z" /></>,
  cleaning: <><path d="M12 4l1.3 3.7L17 9l-3.7 1.3L12 14l-1.3-3.7L7 9l3.7-1.3z" /><path d="M18 14l.6 1.4L20 16l-1.4.6L18 18l-.6-1.4L16 16l1.4-.6z" /></>,
  storing: <><rect x="4" y="8" width="16" height="10" rx="2" /><path d="M4 12h16M10 15h4M7 8l1.5-3h7L17 8" /></>,
};

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  if (name in ASSET_ICONS) {
    const url = ASSET_ICONS[name as AssetIconName];
    return <span className="icon-mask" aria-hidden="true" style={{ width: size, height: size, maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name as DrawnIconName]}
    </svg>
  );
}
