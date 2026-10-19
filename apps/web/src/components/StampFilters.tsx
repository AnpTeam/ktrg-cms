/**
 * Three SVG filters that make a stamped seal look pressed by hand: the edge wobbles a little and the ink has
 * tiny gaps, a different pattern for each (`stamp-ink-1` to `-3`). Rendered once in the layout; the seals
 * point at them with `filter: url(#stamp-ink-N)`. Where a browser ignores the filter the seal is simply clean.
 */
export function StampFilters() {
  return (
    <svg aria-hidden="true" width="0" height="0" focusable="false" style={{ position: "absolute" }}>
      {[1, 2, 3].map((n) => (
        <filter key={n} id={`stamp-ink-${n}`} x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={n * 7} result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed={n * 13} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 4.7" result="gaps" />
          <feComposite in="rough" in2="gaps" operator="in" />
        </filter>
      ))}
    </svg>
  );
}
