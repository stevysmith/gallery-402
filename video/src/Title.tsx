import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { T } from './theme'
import { display, ui, monoFam } from './fonts'

/**
 * 8s title. A brass door plaque engraved "402" swings in, then the museum's
 * name settles beneath it — the same door furniture the app itself uses.
 */
export const Title = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const plaque = spring({ frame, fps, config: { damping: 14, mass: 0.8 } })
  const name = spring({ frame: frame - 0.7 * fps, fps, config: { damping: 16 } })
  const eyebrow = interpolate(frame, [1.4 * fps, 2.1 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const tagline = interpolate(frame, [2.2 * fps, 3.0 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [7.2 * fps, 8 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // the wall breathes very slightly, like the app's rooms
  const drift = Math.sin(frame / (fps * 4)) * 6

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${T.wall} 0%, ${T.wall2} ${55 + drift}%, ${T.wall} 100%)`, alignItems: 'center', justifyContent: 'center', opacity: fadeOut }}>
      <div
        style={{
          transform: `translateY(${(1 - plaque) * -60}px) scale(${0.92 + plaque * 0.08})`,
          opacity: plaque,
          background: `linear-gradient(180deg, ${T.brass2}, ${T.brass})`,
          color: T.ink,
          fontFamily: monoFam,
          fontWeight: 500,
          fontSize: 64,
          letterSpacing: '0.18em',
          padding: '18px 54px 16px 62px',
          borderRadius: 10,
          boxShadow: '0 14px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        402
      </div>
      <div
        style={{
          marginTop: 44,
          fontFamily: display,
          fontSize: 148,
          color: T.onWall,
          transform: `translateY(${(1 - name) * 40}px)`,
          opacity: name,
          lineHeight: 1,
        }}
      >
        Gallery 402
      </div>
      <div style={{ marginTop: 30, fontFamily: ui, fontWeight: 500, fontSize: 26, letterSpacing: '0.32em', color: T.brass, opacity: eyebrow }}>
        PAYMENT REQUIRED
      </div>
      <div style={{ marginTop: 26, fontFamily: ui, fontSize: 30, color: T.onWall, opacity: tagline * 0.85 }}>
        You look at the paintings. Your agent buys the tickets.
      </div>
    </AbsoluteFill>
  )
}
