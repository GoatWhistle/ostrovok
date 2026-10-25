import type { ReactNode, SVGProps } from "react"

export type GlyphProps = SVGProps<SVGSVGElement>

function glyph(body: ReactNode) {
  return function OwnGlyph(props: GlyphProps) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {body}
      </svg>
    )
  }
}

const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="0.9" fill="currentColor" />

export const Sea = glyph(
  <path d="M2.5 9.5c1.6 0 2.4-1.5 4.75-1.5S10.4 9.5 12 9.5s2.4-1.5 4.75-1.5 3.15 1.5 4.75 1.5M2.5 14.5c1.6 0 2.4-1.5 4.75-1.5s3.15 1.5 4.75 1.5 2.4-1.5 4.75-1.5 3.15 1.5 4.75 1.5M2.5 19.5c1.6 0 2.4-1.5 4.75-1.5s3.15 1.5 4.75 1.5 2.4-1.5 4.75-1.5 3.15 1.5 4.75 1.5" />,
)
export const SunsetView = glyph(
  <path d="M6 15.5a6 6 0 0 1 12 0M2.5 15.5h19M6.5 19.5h11M12 3.5v3.5M9.5 5.5 12 3l2.5 2.5M4.4 9.4l1.4 1.4M19.6 9.4l-1.4 1.4" />,
)
export const Quiet = glyph(<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4ZM16 9.5l5 5M21 9.5l-5 5" />)
export const Nightlife = glyph(<path d="M5 4.5h14l-7 8ZM12 12.5v7M8 19.5h8M15.5 8.5l3-4" />)
export const Blackout = glyph(
  <path d="M3.5 4h17M5.5 4v15.5c2 0 3.5-1.4 3.5-4.5V4M18.5 4v15.5c-2 0-3.5-1.4-3.5-4.5V4M9 4h6v12.5" />,
)
export const Height = glyph(
  <path d="M7 20.5V6l5-2.5L17 6v14.5M4 20.5h16M10 9h4M10 12.5h4M10 16h4M20.5 4v9M19 5.5 20.5 4 22 5.5" />,
)
export const Walk = glyph(
  <>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="m9.5 21 2.5-6.5 2.5 2.5V21M12 14.5l1-5.5-3.5 1.5L8 13M13 9l2 3 3 1" />
  </>,
)
export const Hotelier = glyph(
  <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.9-3.6 3.6-5.5 7-5.5s6.1 1.9 7 5.5M14.5 18l1.8 1.8 3.2-3.3" />
  </>,
)
export const Computed = glyph(
  <>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9.5 2.5v3.5M14.5 2.5v3.5M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5M9.5 12.5 11 14l3.5-3.5" />
  </>,
)
export const Osm = glyph(
  <>
    <path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2Z" />
    <circle cx="15" cy="12" r="2" />
  </>,
)
export const Source = glyph(
  <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.2-1.2" />,
)
export const History = glyph(
  <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9M12 8v4.5l3 2" />,
)
export const Confirmed = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8 12.3 2.8 2.8L16.3 9.5" />
  </>,
)
export const Rejected = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </>,
)
export const Pending = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
)
export const Conflict = glyph(
  <>
    <path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.1 12.4a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3ZM12 9.5v4" />
    {dot(12, 16.6)}
  </>,
)
export const Stale = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.6" />
    <path d="M12 8v4.5" />
    {dot(12, 15.8)}
  </>,
)
export const Unknown = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6" />
    {dot(12, 16.9)}
  </>,
)
export const Partial = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" />
  </>,
)
export const Guests = glyph(
  <>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 19.5c.8-3.3 3.1-5 6-5s5.2 1.7 6 5M15.5 5.3a3.5 3.5 0 0 1 0 6.4M17.5 14.8c1.8.6 3 2.1 3.5 4.7" />
  </>,
)
