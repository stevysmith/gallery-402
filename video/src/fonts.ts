import { loadFont as serif } from '@remotion/google-fonts/InstrumentSerif'
import { loadFont as sans } from '@remotion/google-fonts/IBMPlexSans'
import { loadFont as mono } from '@remotion/google-fonts/IBMPlexMono'

export const display = serif('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily
export const ui = sans('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily
export const monoFam = mono('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily
