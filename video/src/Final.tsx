import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Title } from './Title'
import { X402Flow } from './X402Flow'
import { EndCard } from './EndCard'
import { Img } from 'remotion'
import { EDL, VO_FILE, type Segment } from './edits'
import { T } from './theme'
import { ui } from './fonts'

const FPS = 30
const CARDS = { Title, X402Flow, EndCard } as const

export const finalDuration = () => Math.round(EDL.reduce((s, e) => s + e.duration, 0) * FPS)

/** A 12-frame dip-to-wall between segments, so butt cuts don't jar. */
const Dip = ({ dipIn = true, dipOut = true }: { dipIn?: boolean; dipOut?: boolean }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  // opaque at each boundary, transparent through the body of the segment
  const o = Math.max(
    dipIn ? interpolate(frame, [0, 6], [1, 0], { extrapolateRight: 'clamp' }) : 0,
    dipOut ? interpolate(frame, [durationInFrames - 6, durationInFrames], [0, 1], { extrapolateLeft: 'clamp' }) : 0,
  )
  return <AbsoluteFill style={{ background: T.wall, opacity: o, pointerEvents: 'none' }} />
}

/** A photograph with a slow push-in, for pages that refuse to be filmed. */
const Still = ({ src }: { src: string }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.07])
  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', transform: `scale(${scale})` }} />
    </AbsoluteFill>
  )
}

/** A muted-viewer's guide: one small chip, lower left, per key segment. */
const Caption = ({ text }: { text: string }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const o = Math.min(
    interpolate(frame, [0.4 * fps, 0.9 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [durationInFrames - 0.6 * fps, durationInFrames - 0.15 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )
  return (
    <div
      style={{
        position: 'absolute', left: 48, bottom: 42, opacity: o,
        transform: `translateY(${(1 - o) * 10}px)`,
        background: 'rgba(23,48,42,0.92)', border: `1px solid ${T.brass}`,
        color: T.paper, fontFamily: ui, fontSize: 26, fontWeight: 500,
        padding: '10px 20px', borderRadius: 8, letterSpacing: '0.01em',
      }}
    >
      {text}
    </div>
  )
}

export const Final = () => {
  let at = 0
  return (
    <AbsoluteFill style={{ background: T.wall }}>
      {EDL.map((seg: Segment, i) => {
        const from = at
        const frames = Math.round(seg.duration * FPS)
        at += frames
        return (
          <Sequence key={i} from={from} durationInFrames={frames}>
            {seg.kind === 'still' ? (
              <Still src={seg.src} />
            ) : seg.kind === 'card' ? (
              (() => { const C = CARDS[seg.comp]; return <C /> })()
            ) : (
              <OffthreadVideo
                src={staticFile(seg.src)}
                startFrom={Math.round(seg.startFrom * FPS)}
                playbackRate={seg.rate ?? 1}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: T.wall }}
              />
            )}
            {seg.kind === 'clip' && seg.caption ? <Caption text={seg.caption} /> : null}
            <Dip dipIn={seg.kind === 'clip' ? seg.dipIn : undefined} dipOut={seg.kind === 'clip' ? seg.dipOut : undefined} />
          </Sequence>
        )
      })}
      {VO_FILE ? <Audio src={staticFile(VO_FILE)} /> : null}
    </AbsoluteFill>
  )
}
