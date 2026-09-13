/**
 * Shared max-width + responsive horizontal gutter for the application's
 * whole desktop content canvas: every authenticated page's content column
 * (PageContainer), the AppNav's inner content row, and the public Landing
 * page / PublicHeader — so authenticated and public surfaces never drift
 * into different width systems.
 *
 * ~24px mobile / ~32px tablet (md) / ~40px large desktop (lg) gutters,
 * centered up to 1600px. Below that width the content simply fills the
 * viewport (minus gutters); above it, the remainder is intentional
 * whitespace rather than ever-widening lines of text/content — at ~1798px
 * that leaves roughly 100px per side, and at 1920px roughly 160px per
 * side, per the approved desktop-width target.
 */
export const CONTENT_MAX_WIDTH_CLASS = "max-w-[1600px]";
export const CONTENT_PADDING_CLASS = "px-6 md:px-8 lg:px-10";
export const CONTENT_WIDTH_CLASS = `${CONTENT_MAX_WIDTH_CLASS} ${CONTENT_PADDING_CLASS}`;
