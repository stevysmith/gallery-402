import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { z } from 'zod'
import { T } from './theme'
import { display, ui } from './fonts'

export const cardSchema = z.object({
  eyebrow: z.string(),
  line: z.string(),
})

/** 4s section interstitial: wall-label typography on museum green. */
export const Card = ({ eyebrow, line }: z.infer<typeof cardSchema>) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame, fps, config: { damping: 16 } })
  const rule = interpolate(frame, [0.5 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [3.3 * fps, 4 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${T.wall}, ${T.wall2})`, alignItems: 'center', justifyContent: 'center', opacity: fadeOut }}>
      <div style={{ fontFamily: ui, fontWeight: 500, fontSize: 26, letterSpacing: '0.34em', color: T.brass, opacity: rise, transform: `translateY(${(1 - rise) * 20}px)` }}>
        {eyebrow}
      </div>
      <div style={{ width: 90 * rule, height: 3, background: T.brass, margin: '30px 0', opacity: 0.7 }} />
      <div style={{ fontFamily: display, fontSize: 92, color: T.onWall, opacity: rise, transform: `translateY(${(1 - rise) * 34}px)`, maxWidth: 1400, textAlign: 'center', lineHeight: 1.12 }}>
        {line}
      </div>
    </AbsoluteFill>
  )
}
