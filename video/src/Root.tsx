import { Composition } from 'remotion'
import { Title } from './Title'
import { X402Flow } from './X402Flow'
import { Card, cardSchema } from './Card'
import { EndCard } from './EndCard'

const FPS = 30
const HD = { width: 1920, height: 1080, fps: FPS } as const

export const Root = () => (
  <>
    <Composition id="Title" component={Title} durationInFrames={8 * FPS} {...HD} />
    <Composition id="X402Flow" component={X402Flow} durationInFrames={20 * FPS} {...HD} />
    <Composition id="Card-human" component={Card} schema={cardSchema} durationInFrames={4 * FPS} {...HD}
      defaultProps={{ eyebrow: 'THE HUMAN PATH', line: 'You look at the paintings.' }} />
    <Composition id="Card-agent" component={Card} schema={cardSchema} durationInFrames={4 * FPS} {...HD}
      defaultProps={{ eyebrow: 'THE AGENT PATH', line: 'Your agent buys the tickets.' }} />
    <Composition id="Card-surface" component={Card} schema={cardSchema} durationInFrames={4 * FPS} {...HD}
      defaultProps={{ eyebrow: 'THE SURFACE', line: 'Tools follow the room.' }} />
    <Composition id="EndCard" component={EndCard} durationInFrames={12 * FPS} {...HD} />
  </>
)
