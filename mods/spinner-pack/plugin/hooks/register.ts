import type { Register, RenderPropsOf } from 'claude-code'

type Phase = RenderPropsOf['Spinner']['mode']
type Pack = Record<Phase, readonly [verb: string, glyph: string]>

// The Spinner's props carry no glyph: the engine animates its own in front of
// the word. A pack's glyph therefore joins the verb in `word`, ahead of the
// engine's ellipsis, and steps with it each time the turn changes phase.
const PACKS: Record<string, Pack | undefined> = {
  moon: {
    requesting: ['Orbiting', '◐'],
    thinking: ['Waxing', '◓'],
    'tool-input': ['Eclipsing', '◑'],
    'tool-use': ['Eclipsing', '◒'],
    responding: ['Waning', '◐'],
  },
  braille: {
    requesting: ['Computing', '⠋'],
    thinking: ['Computing', '⠹'],
    'tool-input': ['Threading', '⠼'],
    'tool-use': ['Threading', '⠦'],
    responding: ['Weaving', '⠇'],
  },
  coffee: {
    requesting: ['Grinding', '∴'],
    thinking: ['Steeping', '∵'],
    'tool-input': ['Brewing', '∷'],
    'tool-use': ['Brewing', '⁂'],
    responding: ['Pouring', '∴'],
  },
}

export const register: Register = (on, options) => {
  const pack = PACKS[String(options.pack)]
  if (pack === undefined) {
    return // `classic`: the engine's spinner as it is
  }

  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    // A later build may raise a phase this pack does not know yet.
    const entry: Pack[Phase] | undefined = pack[e.props.mode]
    if (entry === undefined || e.props.message !== null) {
      return next(e)
    }

    const [verb, glyph] = entry
    // On the desktop the word names the step being taken (`Creating
    // notes.md`), worth keeping; only its stand-in `Working` gives way.
    const isStep = e.surface === 'desktop' && e.props.word !== 'Working'
    const word = isStep ? e.props.word : verb

    return next({ ...e, props: { ...e.props, word: `${word} ${glyph}` } })
  })
}
