import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { T } from './theme'
import { display, ui, monoFam } from './fonts'

/**
 * 20s animated handshake. Five stations light up left to right as brass wire
 * messages travel between them — the x402 flow told as museum signage.
 */
const STATIONS = [
  { title: 'The page', sub: 'asks for a room' },
  { title: 'Box office', sub: 'answers 402 + price' },
  { title: 'Visitor wallet', sub: 'policy · EIP-3009 sign' },
  { title: 'Facilitator', sub: 'settles USDC on Base' },
  { title: 'Ticket', sub: 'bound to the payer' },
]

const WIRES = [
  { label: 'GET /tickets/ukiyo-e', at: 1.2 },
  { label: '402 · PAYMENT-REQUIRED', at: 4.0, back: true },
  { label: 'PAYMENT-SIGNATURE (gasless)', at: 7.6 },
  { label: 'settled · tx 0x238e…', at: 11.0 },
  { label: 'HMAC ticket · admit one', at: 14.2 },
]

export const X402Flow = () => {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()
  const t = frame / fps

  const boxW = 300
  const gap = (width - 160 - boxW * 5) / 4
  const xs = STATIONS.map((_, i) => 80 + i * (boxW + gap))

  const fadeOut = interpolate(t, [19.2, 20], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const headline = interpolate(t, [0.2, 1.0], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const closing = interpolate(t, [16.4, 17.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, ${T.wall}, ${T.wall2})`, opacity: fadeOut }}>
      <div style={{ position: 'absolute', top: 96, width: '100%', textAlign: 'center', opacity: headline }}>
        <div style={{ fontFamily: ui, fontWeight: 500, fontSize: 22, letterSpacing: '0.3em', color: T.brass }}>UNDER EVERY DOOR</div>
        <div style={{ fontFamily: display, fontSize: 76, color: T.onWall, marginTop: 14 }}>The same handshake</div>
      </div>

      {/* stations */}
      {STATIONS.map((s, i) => {
        const appear = spring({ frame: frame - (0.4 + i * 0.55) * fps, fps, config: { damping: 15 } })
        // a station glows while the wire aimed at it is arriving
        const wire = WIRES[i - 1]
        const glow = wire ? interpolate(t, [wire.at + 1.1, wire.at + 1.5, wire.at + 3.2], [0, 1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
        return (
          <div
            key={s.title}
            style={{
              position: 'absolute',
              left: xs[i],
              top: 430,
              width: boxW,
              padding: '30px 26px',
              borderRadius: 12,
              background: T.paper,
              color: T.ink,
              opacity: appear,
              transform: `translateY(${(1 - appear) * 34}px)`,
              boxShadow: `0 10px 34px rgba(0,0,0,0.4), 0 0 ${34 * glow}px ${10 * glow}px rgba(200,164,93,${0.55 * glow})`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: display, fontSize: 40 }}>{s.title}</div>
            <div style={{ fontFamily: ui, fontSize: 21, color: T.ink2, marginTop: 8 }}>{s.sub}</div>
          </div>
        )
      })}

      {/* wires */}
      {WIRES.map((w, i) => {
        const fromX = xs[Math.min(i, 3)] + boxW
        const toX = xs[Math.min(i + 1, 4)]
        const p = interpolate(t, [w.at, w.at + 1.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const gone = interpolate(t, [w.at + 3.4, w.at + 4.2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        if (p <= 0) return null
        const x = w.back ? toX - (toX - fromX) * (1 - p) : fromX + (toX - fromX) * p
        const dotX = w.back ? toX + fromX - x : x
        return (
          <div key={w.label} style={{ opacity: gone }}>
            <div style={{ position: 'absolute', left: fromX, top: 505, width: (toX - fromX) * p, height: 3, background: T.brass, opacity: 0.5 }} />
            <div style={{ position: 'absolute', left: dotX - 7, top: 499, width: 14, height: 14, borderRadius: 7, background: T.brass2, boxShadow: `0 0 16px ${T.brass}` }} />
            <div
              style={{
                position: 'absolute',
                left: (fromX + toX) / 2,
                top: w.back ? 552 : 386,
                transform: 'translateX(-50%)',
                fontFamily: monoFam,
                fontSize: 21,
                color: T.brass2,
                background: 'rgba(23,48,42,0.85)',
                padding: '7px 16px',
                borderRadius: 7,
                whiteSpace: 'nowrap',
                opacity: p,
              }}
            >
              {w.label}
            </div>
          </div>
        )
      })}

      <div style={{ position: 'absolute', bottom: 130, width: '100%', textAlign: 'center', opacity: closing }}>
        <div style={{ fontFamily: display, fontSize: 46, color: T.onWall }}>No account. No card form. No redirect.</div>
        <div style={{ fontFamily: ui, fontSize: 24, color: T.brass, marginTop: 14, letterSpacing: '0.08em' }}>
          x402 v2 · gasless EIP-3009 · USDC on Base
        </div>
      </div>
    </AbsoluteFill>
  )
}
