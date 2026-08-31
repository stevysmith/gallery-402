import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Title } from './Title'
import { X402Flow } from './X402Flow'
import { EndCard } from './EndCard'
import { EDL, VO_FILE, type Segment } from './edits'
import { T } from './theme'

const FPS = 30
const CARDS = { Title, X402Flow, EndCard } as const

export const finalDuration = () => Math.round(EDL.reduce((s, e) => s + e.duration, 0) * FPS)

/** A 12-frame dip-to-wall between segments, so butt cuts don't jar. */
const Dip = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const o = Math.min(
    interpolate(frame, [0, 6], [1, 0], { extrapolateRight: 'clamp' }),
    interpolate(frame, [durationInFrames - 6, durationInFrames], [0, 1], { extrapolateLeft: 'clamp' }),
  )
  return <AbsoluteFill style={{ background: T.wall, opacity: 1 - o, pointerEvents: 'none' }} />
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
            {seg.kind === 'card' ? (
              (() => { const C = CARDS[seg.comp]; return <C /> })()
            ) : (
              <OffthreadVideo
                src={staticFile(seg.src)}
                startFrom={Math.round(seg.startFrom * FPS)}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: T.wall }}
              />
            )}
            <Dip />
          </Sequence>
        )
      })}
      <Audio src={staticFile(VO_FILE)} />
    </AbsoluteFill>
  )
}
