import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { T } from './theme'
import { display, ui, monoFam } from './fonts'

const ROWS = [
  { label: 'VISIT', value: 'stacktr.ee/p/86HeLDvH8p01xLpff43ybV' },
  { label: 'REPO', value: 'github.com/stevysmith/gallery-402' },
  { label: 'LIBRARY', value: 'npm i @stevysmith/agentk' },
  { label: 'REAL SETTLEMENT', value: '0xfa53dc8d…907f · 0.02 USDC · Base' },
]

/** 12s close: the plaque again, then where to go. */
export const EndCard = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const name = spring({ frame, fps, config: { damping: 15 } })

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${T.wall}, ${T.wall2})`, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: display, fontSize: 110, color: T.onWall, opacity: name, transform: `translateY(${(1 - name) * 30}px)` }}>
        Gallery 402
      </div>
      <div style={{ fontFamily: ui, fontWeight: 500, fontSize: 22, letterSpacing: '0.32em', color: T.brass, marginTop: 16, opacity: name }}>
        PAYMENT REQUIRED — AND THAT'S THE POINT
      </div>
      <div style={{ marginTop: 64, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {ROWS.map((r, i) => {
          const a = spring({ frame: frame - (1.0 + i * 0.5) * fps, fps, config: { damping: 16 } })
          return (
            <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', gap: 30, opacity: a, transform: `translateX(${(1 - a) * -26}px)` }}>
              <div style={{ fontFamily: ui, fontWeight: 600, fontSize: 21, letterSpacing: '0.2em', color: T.brass, width: 300, textAlign: 'right' }}>{r.label}</div>
              <div style={{ fontFamily: monoFam, fontSize: 30, color: T.paper }}>{r.value}</div>
            </div>
          )
        })}
      </div>
      <div
        style={{
          marginTop: 70,
          fontFamily: ui,
          fontSize: 22,
          color: T.onWall,
          opacity: interpolate(frame, [4.2 * fps, 5.0 * fps], [0, 0.75], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        Built for the WebMCP Challenge · works in ChatGPT desktop &amp; Chrome
      </div>
    </AbsoluteFill>
  )
}
