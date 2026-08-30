/**
 * The collection. Every work is public domain (CC0) from a museum open-access
 * programme; `credit` and `sourceUrl` carry the museum's own attribution.
 * Prices are what a wing ticket costs over x402 (USD, settled in USDC).
 */
export type Wing = { id: string; name: string; tagline: string; price: string; blurb: string }
export type Artwork = {
  id: string
  wing: string
  file: string
  title: string
  artist: string
  date: string
  medium: string
  museum: string
  credit: string
  sourceUrl: string
  /** a short curator's note shown beside the work */
  note: string
  /** Real size of the object, in centimetres. The gallery hangs works to scale,
   *  because how big a thing actually is turns out to be most of what a docent
   *  talks about. Sourced from each museum's own record. */
  widthCm: number
  heightCm: number
}

export const MUSEUM = {
  name: 'Gallery 402',
  tagline: 'Payment Required. A museum whose paywall is handled by your agent.',
  about:
    'Gallery 402 is a virtual museum of public-domain masterworks. Entry to each wing costs a few cents, paid over HTTP 402 (x402) in USDC. ' +
    'The page exposes its box office as WebMCP tools, so the human looks at paintings while their agent buys tickets inside a spending policy the human set.',
}

export const DAY_PASS = { id: 'day-pass', name: 'Day pass — every wing', price: '$0.04' }

/**
 * Curated tours, written by the museum. A visitor can take one with a click —
 * no agent, no model — and an agent can offer the same ones by id. Spotlight
 * regions are fractions of the image.
 */
export type CuratedTour = { id: string; theme: string; blurb: string; minutes: number; stops: { artwork: string; note: string; spotlight?: { x: number; y: number; w: number; h: number } }[] }

export const TOURS: CuratedTour[] = [
  {
    id: 'light',
    theme: 'Light and weather',
    blurb: 'Four painters chasing the same impossible subject: the air itself.',
    minutes: 6,
    stops: [
      { artwork: 'sunrise-marine', note: 'Start at dawn. Monet is painting Le Havre harbour in the same season as the canvas that gave Impressionism its name — the sun is barely a smudge, but you know exactly what time it is.' },
      { artwork: 'wheatstacks-snow', note: 'Now winter. Most painters would reach for white; Monet found pink, blue and lilac in the snow. The stack is an excuse — the subject is the light falling on it.', spotlight: { x: 0.05, y: 0.35, w: 0.45, h: 0.4 } },
      { artwork: 'shower-below-summit', note: 'Hokusai does weather as structure: a storm breaking on the lower slopes while the summit stays in sunshine, and lightning drawn as one red jagged line.', spotlight: { x: 0.08, y: 0.55, w: 0.5, h: 0.35 } },
      { artwork: 'driving-rain-shono', note: 'And rain as pure graphic invention — cut straight into the woodblock as diagonal lines. Travellers bend; the whole print leans with them.' },
      { artwork: 'water-pitcher', note: 'End indoors. Vermeer’s morning light comes through leaded glass and lands on a brass basin — the same subject as the harbour, at the scale of a single room.', spotlight: { x: 0.05, y: 0.1, w: 0.35, h: 0.5 } },
    ],
  },
  {
    id: 'faces',
    theme: 'Faces',
    blurb: 'Four people looking back at you, painted three centuries apart.',
    minutes: 5,
    stops: [
      { artwork: 'self-portrait-1887', note: 'Van Gogh in Paris, teaching himself pointillism on his own face. Stand close: the skin is built from short dashes of opposing colour that only settle into a face at a distance.', spotlight: { x: 0.3, y: 0.15, w: 0.4, h: 0.4 } },
      { artwork: 'joseph-roulin', note: 'The Arles postman, and one of the few friends Van Gogh had there. The beard is practically a landscape in its own right.', spotlight: { x: 0.25, y: 0.45, w: 0.5, h: 0.35 } },
      { artwork: 'study-young-woman', note: 'A tronie — a study of a face rather than a portrait of a person. She is a quieter sister to the Girl with a Pearl Earring, and she is looking directly at you.' },
      { artwork: 'the-milkmaid', note: 'Not a face at all, in the end: her eyes are down on the work. Vermeer gives a kitchen maid the gravity other painters saved for saints.', spotlight: { x: 0.2, y: 0.62, w: 0.35, h: 0.25 } },
    ],
  },
  {
    id: 'water',
    theme: 'Water',
    blurb: 'From a pond you could step into to a wave that would kill you.',
    minutes: 5,
    stops: [
      { artwork: 'water-lilies', note: 'No horizon, no bank, no sky except as reflection. Monet removed every clue about where you are standing — you are simply above the water.' },
      { artwork: 'cliff-walk-pourville', note: 'Water at a distance, and wind: the grass and the sea are painted with the same restless stroke, so the whole cliff seems to be moving.' },
      { artwork: 'great-wave', note: 'And water as a threat. Note the scale trick — Fuji is the small triangle in the trough, and the wave’s claws are what your eye reads as the mountain.', spotlight: { x: 0.0, y: 0.05, w: 0.5, h: 0.5 } },
      { artwork: 'moon-viewing-promontory', note: 'Hiroshige calms it back down: a teahouse balcony, the bay, a full moon, and the shadow of someone just out of frame.' },
    ],
  },
]

export const WINGS: Wing[] = [
  {
    id: 'impressionists',
    name: 'Impressionist Wing',
    tagline: 'Monet, six ways of looking at light.',
    price: '$0.01',
    blurb: 'Six canvases by Claude Monet, from a smoky Paris station to the water garden at Giverny.',
  },
  {
    id: 'van-gogh',
    name: 'Van Gogh Room',
    tagline: 'Arles and Saint-Rémy, 1887–1889.',
    price: '$0.02',
    blurb: 'Six works from the two most intense years of Vincent van Gogh’s life.',
  },
  {
    id: 'ukiyo-e',
    name: 'Print Room',
    tagline: 'Hokusai and Hiroshige: the floating world.',
    price: '$0.01',
    blurb: 'Six colour woodblock prints from the great Edo-period landscape series.',
  },
  {
    id: 'dutch-cabinet',
    name: 'Dutch Cabinet',
    tagline: 'Vermeer and the quiet rooms of Delft.',
    price: '$0.02',
    blurb: 'Four Vermeers and two of his Delft contemporaries — small rooms, enormous stillness.',
  },
]

export const ARTWORKS: Artwork[] = [
  // ── Impressionist Wing ──
  {
    id: 'water-lilies', wing: 'impressionists', file: 'monet-water-lilies.jpg', widthCm: 94.1, heightCm: 89.9,
    title: 'Water Lilies', artist: 'Claude Monet', date: '1906', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Mr. and Mrs. Martin A. Ryerson Collection', sourceUrl: 'https://www.artic.edu/artworks/16568',
    note: 'One of the early Giverny water-lily canvases: no horizon, no bank — just the pond’s surface holding sky, cloud and flowers at once.',
  },
  {
    id: 'gare-saint-lazare', wing: 'impressionists', file: 'monet-gare-saint-lazare.jpg', widthCm: 80.2, heightCm: 60.3,
    title: 'Arrival of the Normandy Train, Gare Saint-Lazare', artist: 'Claude Monet', date: '1877', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Mr. and Mrs. Martin A. Ryerson Collection', sourceUrl: 'https://www.artic.edu/artworks/16571',
    note: 'Monet persuaded the station master to hold trains and fill the shed with steam. The modern city, painted as weather.',
  },
  {
    id: 'stacks-of-wheat', wing: 'impressionists', file: 'monet-stacks-of-wheat.jpg', widthCm: 100.5, heightCm: 60,
    title: 'Stacks of Wheat (End of Summer)', artist: 'Claude Monet', date: '1890–91', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Gift of Arthur M. Wood, Sr. in memory of Pauline Palmer Wood', sourceUrl: 'https://www.artic.edu/artworks/64818',
    note: 'From the series that made Monet’s name as a painter of time itself: the same stacks, painted again and again as the light moved.',
  },
  {
    id: 'cliff-walk-pourville', wing: 'impressionists', file: 'monet-cliff-walk-pourville.jpg', widthCm: 82.3, heightCm: 66.5,
    title: 'Cliff Walk at Pourville', artist: 'Claude Monet', date: '1882', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Mr. and Mrs. Lewis Larned Coburn Memorial Collection', sourceUrl: 'https://www.artic.edu/artworks/14620',
    note: 'Two figures on the Normandy cliffs, the grass and sea worked in the same restless strokes so that wind seems to blow through the whole picture.',
  },
  {
    id: 'sunrise-marine', wing: 'impressionists', file: 'monet-sunrise-marine.jpg', widthCm: 61, heightCm: 50.2,
    title: 'Sunrise (Marine)', artist: 'Claude Monet', date: '1872 or 1873', medium: 'Oil on canvas',
    museum: 'The J. Paul Getty Museum', credit: 'The J. Paul Getty Museum, Los Angeles', sourceUrl: 'https://www.getty.edu/art/collection/object/103QT7',
    note: 'Painted at Le Havre in the same season as the “Impression, Sunrise” that named the movement — a harbour dissolving into orange and grey.',
  },
  {
    id: 'wheatstacks-snow', wing: 'impressionists', file: 'monet-wheatstacks-snow.jpg', widthCm: 100.3, heightCm: 64.8,
    title: 'Wheatstacks, Snow Effect, Morning', artist: 'Claude Monet', date: '1891', medium: 'Oil on canvas',
    museum: 'The J. Paul Getty Museum', credit: 'The J. Paul Getty Museum, Los Angeles', sourceUrl: 'https://www.getty.edu/art/collection/object/103RK8',
    note: 'The winter stacks. Pink and blue snow, long shadows — Monet finding colour in a scene most painters would have left white.',
  },

  // ── Van Gogh Room ──
  {
    id: 'the-bedroom', wing: 'van-gogh', file: 'vangogh-bedroom.jpg', widthCm: 92.3, heightCm: 73.6,
    title: 'The Bedroom', artist: 'Vincent van Gogh', date: '1889', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Helen Birch Bartlett Memorial Collection', sourceUrl: 'https://www.artic.edu/artworks/28560',
    note: 'The second of three versions of his room in the Yellow House at Arles. He wanted the flat colour to suggest “rest, or sleep in general.”',
  },
  {
    id: 'self-portrait-1887', wing: 'van-gogh', file: 'vangogh-self-portrait.jpg', widthCm: 32.5, heightCm: 41,
    title: 'Self-Portrait', artist: 'Vincent van Gogh', date: '1887', medium: 'Oil on artist’s board',
    museum: 'Art Institute of Chicago', credit: 'Joseph Winterbotham Collection', sourceUrl: 'https://www.artic.edu/artworks/80607',
    note: 'Painted in Paris, where he absorbed the pointillists: the face built from short dashes of complementary colour that vibrate against each other.',
  },
  {
    id: 'poets-garden', wing: 'van-gogh', file: 'vangogh-poets-garden.jpg', widthCm: 92.1, heightCm: 73,
    title: 'The Poet’s Garden', artist: 'Vincent van Gogh', date: '1888', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Mr. and Mrs. Lewis Larned Coburn Memorial Collection', sourceUrl: 'https://www.artic.edu/artworks/14586',
    note: 'A public park in Arles, painted to decorate Gauguin’s room before he arrived. Van Gogh imagined Petrarch walking under these trees.',
  },
  {
    id: 'wheat-field-cypresses', wing: 'van-gogh', file: 'vangogh-wheat-field-cypresses.jpg', widthCm: 93.4, heightCm: 73.2,
    title: 'Wheat Field with Cypresses', artist: 'Vincent van Gogh', date: '1889', medium: 'Oil on canvas',
    museum: 'The Metropolitan Museum of Art', credit: 'Purchase, The Annenberg Foundation Gift, 1993', sourceUrl: 'https://www.metmuseum.org/art/collection/search/436535',
    note: 'Made at the asylum in Saint-Rémy. He called the cypress “as beautiful of line and proportion as an Egyptian obelisk.”',
  },
  {
    id: 'irises', wing: 'van-gogh', file: 'vangogh-irises.jpg', widthCm: 94.3, heightCm: 74.3,
    title: 'Irises', artist: 'Vincent van Gogh', date: '1889', medium: 'Oil on canvas',
    museum: 'The J. Paul Getty Museum', credit: 'The J. Paul Getty Museum, Los Angeles', sourceUrl: 'https://www.getty.edu/art/collection/object/103JNH',
    note: 'Painted in his first week at Saint-Rémy, in the asylum garden. One white iris among the blue; the composition owes a debt to Japanese prints.',
  },
  {
    id: 'joseph-roulin', wing: 'van-gogh', file: 'vangogh-joseph-roulin.jpg', widthCm: 24.4, heightCm: 32.1,
    title: 'Portrait of Joseph Roulin', artist: 'Vincent van Gogh', date: '1888', medium: 'Oil on canvas',
    museum: 'The J. Paul Getty Museum', credit: 'The J. Paul Getty Museum, Los Angeles', sourceUrl: 'https://www.getty.edu/art/collection/object/103QZR',
    note: 'The Arles postman, one of Van Gogh’s few close friends there. He painted the whole Roulin family, and the beard here is practically a landscape.',
  },

  // ── Print Room ──
  {
    id: 'great-wave', wing: 'ukiyo-e', file: 'hokusai-great-wave.jpg', widthCm: 37.6, heightCm: 25.4,
    title: 'Under the Wave off Kanagawa (The Great Wave)', artist: 'Katsushika Hokusai', date: '1830/33', medium: 'Colour woodblock print',
    museum: 'Art Institute of Chicago', credit: 'Clarence Buckingham Collection', sourceUrl: 'https://www.artic.edu/artworks/24645',
    note: 'From “Thirty-Six Views of Mount Fuji.” The mountain is tiny; the wave’s claws are the point. Printed with the then-new Prussian blue.',
  },
  {
    id: 'south-wind-clear-sky', wing: 'ukiyo-e', file: 'hokusai-south-wind-clear-sky.jpg', widthCm: 37.5, heightCm: 25.6,
    title: 'South Wind, Clear Sky (Red Fuji)', artist: 'Katsushika Hokusai', date: 'early 1830s', medium: 'Colour woodblock print',
    museum: 'The Cleveland Museum of Art', credit: 'Bequest of Edward L. Whittemore', sourceUrl: 'https://clevelandart.org/art/1930.189',
    note: 'The calm counterpart to the Great Wave: Fuji at dawn in late summer, when the mountain briefly turns red.',
  },
  {
    id: 'shower-below-summit', wing: 'ukiyo-e', file: 'hokusai-shower-below-summit.jpg', widthCm: 37.6, heightCm: 25.7,
    title: 'Shower Below the Summit', artist: 'Katsushika Hokusai', date: 'c. 1830/33', medium: 'Colour woodblock print',
    museum: 'Art Institute of Chicago', credit: 'Clarence Buckingham Collection', sourceUrl: 'https://www.artic.edu/artworks/87008',
    note: 'A storm breaks on the lower slopes while the peak stays in sunshine — lightning drawn as a single jagged red line.',
  },
  {
    id: 'driving-rain-shono', wing: 'ukiyo-e', file: 'hiroshige-driving-rain-shono.jpg', widthCm: 38, heightCm: 25.4,
    title: 'Driving Rain at Shōno', artist: 'Utagawa Hiroshige', date: '1833', medium: 'Colour woodblock print',
    museum: 'The Cleveland Museum of Art', credit: 'Gift of Mrs. T. Wingate Todd', sourceUrl: 'https://clevelandart.org/art/1948.306',
    note: 'From “Fifty-Three Stations of the Tōkaidō.” Travellers caught in a downpour; the rain is cut as diagonal lines straight into the block.',
  },
  {
    id: 'moon-viewing-promontory', wing: 'ukiyo-e', file: 'hiroshige-moon-viewing-promontory.jpg', widthCm: 22.8, heightCm: 33.9,
    title: 'The Moon-Viewing Promontory', artist: 'Utagawa Hiroshige', date: '1857', medium: 'Colour woodblock print',
    museum: 'The Cleveland Museum of Art', credit: 'The Kelvin Smith Collection', sourceUrl: 'https://clevelandart.org/art/1985.320',
    note: 'From “One Hundred Famous Views of Edo.” A teahouse balcony, a full moon over the bay, and the shadow of someone just out of frame.',
  },
  {
    id: 'mishima-morning-mist', wing: 'ukiyo-e', file: 'hiroshige-mishima-morning-mist.jpg', widthCm: 37.5, heightCm: 24.3,
    title: 'Mishima: Morning Mist', artist: 'Utagawa Hiroshige', date: 'c. 1833/34', medium: 'Colour woodblock print',
    museum: 'Art Institute of Chicago', credit: 'Gift of H. R. Warner', sourceUrl: 'https://www.artic.edu/artworks/10926',
    note: 'Figures leave a shrine at dawn; everything behind them is printed as pale silhouette, an early and daring use of fog as a subject.',
  },

  // ── Dutch Cabinet ──
  {
    id: 'the-milkmaid', wing: 'dutch-cabinet', file: 'vermeer-milkmaid.jpg', widthCm: 41, heightCm: 45.5,
    title: 'The Milkmaid', artist: 'Johannes Vermeer', date: 'c. 1660', medium: 'Oil on canvas',
    museum: 'Rijksmuseum', credit: 'Rijksmuseum, Amsterdam', sourceUrl: 'https://www.rijksmuseum.nl/en/collection/SK-A-2344',
    note: 'A kitchen maid pouring milk, painted with the seriousness other artists reserved for saints. Look at the bread — the paint is almost sculpted.',
  },
  {
    id: 'the-little-street', wing: 'dutch-cabinet', file: 'vermeer-little-street.jpg', widthCm: 44, heightCm: 54.3,
    title: 'The Little Street', artist: 'Johannes Vermeer', date: 'c. 1658', medium: 'Oil on canvas',
    museum: 'Rijksmuseum', credit: 'Rijksmuseum, Amsterdam', sourceUrl: 'https://www.rijksmuseum.nl/en/collection/SK-A-2860',
    note: 'One of only two surviving Vermeer exteriors. A Delft street so ordinary it becomes strange when you look for long enough.',
  },
  {
    id: 'water-pitcher', wing: 'dutch-cabinet', file: 'vermeer-water-pitcher.jpg', widthCm: 40.6, heightCm: 45.7,
    title: 'Young Woman with a Water Pitcher', artist: 'Johannes Vermeer', date: 'c. 1662', medium: 'Oil on canvas',
    museum: 'The Metropolitan Museum of Art', credit: 'Marquand Collection, Gift of Henry G. Marquand, 1889', sourceUrl: 'https://www.metmuseum.org/art/collection/search/437881',
    note: 'The first Vermeer to enter an American collection. Morning light through leaded glass, a map, a pitcher — the whole Vermeer vocabulary in one room.',
  },
  {
    id: 'study-young-woman', wing: 'dutch-cabinet', file: 'vermeer-study-young-woman.jpg', widthCm: 40, heightCm: 44.5,
    title: 'Study of a Young Woman', artist: 'Johannes Vermeer', date: 'c. 1665–67', medium: 'Oil on canvas',
    museum: 'The Metropolitan Museum of Art', credit: 'Gift of Mr. and Mrs. Charles Wrightsman, 1979', sourceUrl: 'https://www.metmuseum.org/art/collection/search/437879',
    note: 'A tronie — a study of a face rather than a portrait of a person. A quieter sister to the Girl with a Pearl Earring.',
  },
  {
    id: 'the-terrace', wing: 'dutch-cabinet', file: 'delft-the-terrace.jpg', widthCm: 87.4, heightCm: 106.9,
    title: 'The Terrace', artist: 'Unknown Delft painter', date: 'c. 1660', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Robert A. Waller Memorial Fund', sourceUrl: 'https://www.artic.edu/artworks/62460',
    note: 'A Delft picture from Vermeer’s own decade, once attributed to Pieter de Hooch: figures on a terrace, and that same clear northern light.',
  },
  {
    id: 'music-lesson', wing: 'dutch-cabinet', file: 'ochtervelt-music-lesson.jpg', widthCm: 65.5, heightCm: 80.2,
    title: 'The Music Lesson', artist: 'Jacob Ochtervelt', date: '1671', medium: 'Oil on canvas',
    museum: 'Art Institute of Chicago', credit: 'Mr. and Mrs. Martin A. Ryerson Collection', sourceUrl: 'https://www.artic.edu/artworks/16398',
    note: 'Ochtervelt trained alongside de Hooch. Satin, a lute, a glance — the polite Dutch interior with something slightly less polite going on.',
  },
]
