import Editor from '@hufe921/canvas-editor'
import spellcheckPlugin from './spellcheck'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(
    container,
    {
      main: [
        {
          value:
            'Hello world! This is a demostration of the speling check plugin. ' +
            'Click on any misspelledd word to see sugestions, or choose to ignore it.'
        }
      ]
    },
    {
      locale: 'en',
      spellcheck: {
        disabled: false,
        color: '#f54a45'
      }
    }
  )
  instance.use(spellcheckPlugin, {
    suggestionCount: 5,
    ignoreWords: ['canvas-editor'],
    lang: {
      emptyText: 'No suggestions found'
    }
  })
}
