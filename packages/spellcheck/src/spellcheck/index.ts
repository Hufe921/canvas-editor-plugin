import dictionaryConfig from '@cspell/dict-en_us'
import dictionaryUrl from '@cspell-en-us-dictionary'
import {
  decodeFile,
  mapDictionaryInformationToWeightMap,
  normalizeWordForCaseInsensitive,
  type ITrie
} from 'cspell-trie-lib'
import Editor, {
  EDITOR_COMPONENT,
  EditorComponent
} from '@hufe921/canvas-editor'
import './style/index.scss'
import {
  DEFAULT_LOCALE,
  DEFAULT_MIN_WORD_LENGTH,
  DEFAULT_SUGGESTION_COUNT,
  DEFAULT_SUGGESTION_TIMEOUT,
  ICON_ALERT,
  ICON_EYE_OFF,
  PLUGIN_LANG_MAP,
  PLUGIN_PREFIX
} from './constant'
import {
  ISpellcheckLang,
  ISpellcheckPluginOption,
  ISpellcheckRange,
  ISpellcheckWord
} from './interface'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeSpellcheckIgnoreWord(word: string): void
  }
}

interface ISpellcheckPluginData {
  word: string
}

const ENGLISH_WORD_REGEXP = /^[A-Za-z]+(?:['’][A-Za-z]+)*$/
const dictionaryDefinition = dictionaryConfig.dictionaryDefinitions[0]
const weightMap = mapDictionaryInformationToWeightMap(
  dictionaryDefinition.dictionaryInformation
)
let dictionaryPromise: Promise<ITrie> | null = null

async function loadDictionary() {
  const response = await fetch(dictionaryUrl)
  if (!response.ok) {
    throw new Error(`Failed to load dictionary: ${response.status}`)
  }
  const content = new Uint8Array(await response.arrayBuffer())
  const url = new URL(dictionaryDefinition.path, window.location.href)
  if (content[0] !== 0x1f || content[1] !== 0x8b) {
    url.pathname = url.pathname.slice(0, -3)
  }
  return decodeFile({
    url,
    content
  })
}

function getDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = loadDictionary().catch(error => {
      dictionaryPromise = null
      throw error
    })
  }
  return dictionaryPromise
}

function matchWordCase(word: string, suggestion: string) {
  if (word === word.toUpperCase()) return suggestion.toUpperCase()
  if (word[0] === word[0].toUpperCase()) {
    return suggestion[0].toUpperCase() + suggestion.slice(1)
  }
  return suggestion
}

function normalizeWord(word: string) {
  return normalizeWordForCaseInsensitive(word.replaceAll('’', "'"))[0]
}

export default function spellcheckPlugin(
  editor: Editor,
  options: ISpellcheckPluginOption = {}
) {
  const {
    disabled = false,
    suggestionCount = DEFAULT_SUGGESTION_COUNT,
    suggestionTimeout = DEFAULT_SUGGESTION_TIMEOUT,
    ignoreWords = [],
    minWordLength = DEFAULT_MIN_WORD_LENGTH,
    locale,
    lang
  } = options

  const command = editor.command

  // 国际化：优先插件 locale 配置，其次编辑器 locale 配置，回退 zhCN
  const getLang = (): ISpellcheckLang => {
    const currentLocale = (
      locale ||
      command.getOptions().locale ||
      DEFAULT_LOCALE
    )
      .toLowerCase()
      .replace(/[-_]/g, '')
    const sourceLang =
      Object.entries(PLUGIN_LANG_MAP).find(
        ([key]) => key.toLowerCase() === currentLocale
      )?.[1] || PLUGIN_LANG_MAP[DEFAULT_LOCALE]
    return {
      ...sourceLang,
      ...lang
    }
  }

  const ignoreWordSet = new Set<string>(
    ignoreWords.map(word => normalizeWord(word).toLowerCase())
  )
  const isIgnoredWord = (word: string) =>
    ignoreWordSet.has(normalizeWord(word).toLowerCase())

  const getEnglishWordList = (wordList: string[]) => {
    const uniqueWordList: string[] = []
    const wordSet = new Set<string>()
    for (const word of wordList) {
      if (
        word.length < minWordLength ||
        !ENGLISH_WORD_REGEXP.test(word) ||
        isIgnoredWord(word) ||
        wordSet.has(word)
      ) {
        continue
      }
      wordSet.add(word)
      uniqueWordList.push(word)
    }
    return uniqueWordList
  }

  const getIssueSet = (wordList: string[], dictionary: ITrie) => {
    const issueSet = new Set<string>()
    for (const word of wordList) {
      if (!dictionary.hasWord(normalizeWord(word), false)) issueSet.add(word)
    }
    return issueSet
  }

  const getSuggestionList = async (word: string) => {
    if (!ENGLISH_WORD_REGEXP.test(word)) return []
    const dictionary = await getDictionary()
    const suggestions = dictionary.suggest(normalizeWord(word), {
      numSuggestions: suggestionCount,
      includeTies: false,
      ignoreCase: true,
      timeout: suggestionTimeout,
      weightMap
    })
    const suggestionList: string[] = []
    for (const suggestion of suggestions) {
      suggestionList.push(matchWordCase(word, suggestion))
    }
    return suggestionList
  }

  const checkCache = new Map<string, boolean>()
  const suggestionCache = new Map<string, string[]>()

  let popup: HTMLDivElement | null = null
  const removePopup = () => {
    document.removeEventListener('mousedown', removePopup)
    popup?.remove()
    popup = null
  }

  let updateVersion = 0
  const setRangeList = (wordList: ISpellcheckWord[]) => {
    const rangeList: ISpellcheckRange[] = []
    for (const word of wordList) {
      if (checkCache.get(word.word) !== false) continue
      rangeList.push({
        ...word,
        data: {
          word: word.word
        } as ISpellcheckPluginData
      })
    }
    command.executeSetSpellcheckRangeList(rangeList)
  }

  const update = async (version: number) => {
    const wordList = command.getSpellcheckWordList()
    const pendingWordList: string[] = []
    const pendingWordSet = new Set<string>()
    for (const word of wordList) {
      if (checkCache.has(word.word) || pendingWordSet.has(word.word)) continue
      pendingWordSet.add(word.word)
      pendingWordList.push(word.word)
    }
    if (!pendingWordList.length) {
      setRangeList(wordList)
      return
    }

    const englishWordList = getEnglishWordList(pendingWordList)
    for (const word of pendingWordList) {
      if (!englishWordList.includes(word)) checkCache.set(word, true)
    }
    if (!englishWordList.length) {
      setRangeList(wordList)
      return
    }

    let dictionary: ITrie
    try {
      dictionary = await getDictionary()
    } catch {
      setRangeList(wordList)
      return
    }
    if (version !== updateVersion) return
    const issueSet = getIssueSet(englishWordList, dictionary)
    for (const word of englishWordList) {
      checkCache.set(word, !issueSet.has(word))
    }
    if (version !== updateVersion) return
    setRangeList(wordList)
  }

  // 忽略指定单词（不区分大小写），并立即刷新错词标记
  command.executeSpellcheckIgnoreWord = (word: string) => {
    ignoreWordSet.add(normalizeWord(word).toLowerCase())
    const lowerWord = word.toLowerCase()
    for (const cacheWord of checkCache.keys()) {
      if (cacheWord.toLowerCase() === lowerWord) {
        checkCache.set(cacheWord, true)
      }
    }
    scheduleUpdate()
  }

  const openPopup = async (
    evt: MouseEvent,
    range: ISpellcheckRange,
    word: string
  ) => {
    removePopup()
    popup = document.createElement('div')
    const activePopup = popup
    popup.className = `${PLUGIN_PREFIX}-popup`
    popup.setAttribute(EDITOR_COMPONENT, EditorComponent.POPUP)

    // 头部：错词提示
    const header = document.createElement('div')
    header.className = `${PLUGIN_PREFIX}-popup__header`
    const icon = document.createElement('span')
    icon.className = `${PLUGIN_PREFIX}-popup__icon`
    icon.innerHTML = ICON_ALERT
    const title = document.createElement('span')
    title.className = `${PLUGIN_PREFIX}-popup__word`
    title.textContent = word
    header.append(icon, title)
    popup.append(header)

    // 建议词容器
    const body = document.createElement('div')
    body.className = `${PLUGIN_PREFIX}-popup__body`
    popup.append(body)

    popup.style.left = `${evt.clientX + 4}px`
    popup.style.top = `${evt.clientY + 4}px`
    document.body.append(popup)
    window.setTimeout(() => {
      document.addEventListener('mousedown', removePopup, { once: true })
    })

    // 建议词列表
    let suggestionList = suggestionCache.get(word)
    if (!suggestionList) {
      try {
        suggestionList = await getSuggestionList(word)
      } catch {
        return
      }
      suggestionCache.set(word, suggestionList)
    }
    if (popup !== activePopup) return
    const { ignoreText, emptyText } = getLang()
    if (suggestionList.length) {
      for (const suggestion of suggestionList) {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = `${PLUGIN_PREFIX}-popup__suggestion`
        item.textContent = suggestion
        item.onmousedown = event => {
          event.preventDefault()
          event.stopPropagation()
          const { tableId, trIndex, tdIndex } = range
          command.executeSetRange(
            range.startIndex - 1,
            range.endIndex,
            tableId,
            tdIndex,
            tdIndex,
            trIndex,
            trIndex
          )
          command.executeInsertElementList([{ value: suggestion }])
          removePopup()
        }
        body.append(item)
      }
    } else {
      const empty = document.createElement('div')
      empty.className = `${PLUGIN_PREFIX}-popup__empty`
      empty.textContent = emptyText
      body.append(empty)
    }

    // 忽略操作
    const divider = document.createElement('div')
    divider.className = `${PLUGIN_PREFIX}-popup__divider`
    const ignore = document.createElement('button')
    ignore.type = 'button'
    ignore.className = `${PLUGIN_PREFIX}-popup__ignore`
    const ignoreIcon = document.createElement('span')
    ignoreIcon.className = `${PLUGIN_PREFIX}-popup__ignore-icon`
    ignoreIcon.innerHTML = ICON_EYE_OFF
    const ignoreLabel = document.createElement('span')
    ignoreLabel.textContent = `${ignoreText} “${word}”`
    ignore.append(ignoreIcon, ignoreLabel)
    ignore.onmousedown = event => {
      event.preventDefault()
      event.stopPropagation()
      removePopup()
      command.executeSpellcheckIgnoreWord(word)
    }
    popup.append(divider, ignore)
  }

  editor.eventBus.on('spellcheckClick', ({ evt, range }) => {
    const data = range.data as ISpellcheckPluginData | undefined
    if (!data?.word) return
    void openPopup(evt, range, data.word)
  })

  let updateFrame = 0
  const scheduleUpdate = () => {
    removePopup()
    window.cancelAnimationFrame(updateFrame)
    updateVersion++
    if (disabled || command.getOptions().spellcheck?.disabled) return
    const version = updateVersion
    updateFrame = window.requestAnimationFrame(() => {
      void update(version)
    })
  }
  editor.eventBus.on('renderChange', scheduleUpdate)
  scheduleUpdate()
}
