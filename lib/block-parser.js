
const { optionsParse } = require('./options-parser')
const { getSyntaxInfo } = require('./utils/syntax')
const { 
  getFirstCharacter, 
  getLastCharacter, 
  getTextBetweenChars,
  stripIndent, 
  findMinIndent 
} = require('./utils/text')
const { OPEN_WORD, CLOSE_WORD, SYNTAX } = require('./defaults')
// Alt parser https://github.com/LesterLyu/fast-formula-parser/blob/master/grammar/lexing.js

const defaultOptions = {
  syntax: SYNTAX,
  open: OPEN_WORD,
  close: CLOSE_WORD,
}

function parseBlocks(contents, opts = {}) {
  const options = Object.assign({}, defaultOptions, opts)
  const { syntax, open, close } = options
  if (!open) {
    throw new Error('Missing options.open')
  }
  if (!close) {
    throw new Error('Missing options.close')
  }
  if (!syntax) {
    throw new Error('Missing options.syntax')
  }
  const syntaxInfo = getSyntaxInfo(syntax)
  if (!syntaxInfo.pattern) {
    throw new Error(`Unknown syntax "${syntax}"`)
  }
  const [ openComment, closeComment ] = syntaxInfo.pattern

  const patterns = getBlockRegex({
    openComment,
    closeComment,
    openText: open,
    closeText: close
  })

  const newerRegex = patterns.blockPattern
  // console.log('newerRegex', newerRegex)

  /*
  const regexToUse = getBlockRegex({
    openComment,
    closeComment,
    openText: open,
    closeText: close
  })
  console.log('regexToUse', regexToUse)
  */

  // let openTagRegex = getOpenCommentRegex(open, openComment, closeComment)
  // let closeTagRegex = getClosingCommentRegex(close, openComment, closeComment)
  // console.log('openTagRegex', openTagRegex)
  // console.log('patterns.openPattern',  patterns.openPattern)
  // console.log('closeTagRegex', closeTagRegex)
  // console.log('patterns.closePattern',  patterns.closePattern)

  /* Verify comment blocks aren't broken (redos) */
  const { isBalanced, openCount, closeCount } = verifyTagsBalanced(contents, patterns.openPattern, patterns.closePattern)
  const balanced = (closeCount > openCount) ? true : isBalanced
  if (!balanced) {
    throw new Error(`Blocks are unbalanced.
    ${openCount} "${open}" open tags.
    ${closeCount} "${close}" close tags.
    `)
  }

  /* New regex works! */
  const newBlocks = []
  let blockIndex = 0
  while ((newMatches = newerRegex.exec(contents)) !== null) {
    blockIndex++
    let paramString = ''
    let options = {}
    const [ block, spaces, openTag, type, params = '', content, closeTag ] = newMatches

    let transformType = type
    paramString = params.trim()

    /* Account for dashes in transform name. E.g. funky-name-here */
    const dashInTransform = params.match(/^(-[^\s]*)/)
    if (dashInTransform && dashInTransform[1]) {
      transformType = type + dashInTransform[1]
      paramString = paramString.replace(dashInTransform[1], '')
    }
    /*
    console.log('index', newMatches.index)
    console.log('block', block)
    console.log('type', type)
    console.log('params', params)
    console.log('spaces', `"${spaces}"`)
    /** */
    const isMultiline = block.indexOf('\n') > -1
    const indentation = spaces || ''
    let context = {
      isMultiline,
    }
    // console.log('newMatches', newMatches)
    // This is necessary to avoid infinite loops
    if (newMatches.index === newerRegex.lastIndex) {
      newerRegex.lastIndex++
    }
    const openValue = indentation + openTag 
    const openStart = newMatches.index + indentation.length
    const openEnd = openStart + openTag.length


    const closeEnd = newerRegex.lastIndex
    // const finIndentation = (lineOpen === lineClose) ? '' : indentation

    const lineOpen = contents.substr(0, openStart).split('\n').length
    const lineClose = contents.substr(0, closeEnd).split('\n').length

    const contentStart = openStart + openTag.length // + indentation.length// - shift //+ indentation.length
    const contentEnd = contentStart + content.length // + finIndentation.length // + shift
    /* If single line comment block, remove indentation */
    const finIndentation = (lineOpen === lineClose) ? '' : indentation
 
    /* If old syntax XYZ?foo | XYZ:foo */
    if (paramString.match(/^:|^\?/)) {
      paramString = paramString.replace(/^:/, '').replace(/^\?/, '').replace(/\)$/, '')
      options = legacyParseOptions(paramString)
      context.isLegacy = true
    } else {
      options = optionsParse(paramString)
    }
    // console.log('open start', openStart)
    // console.log('openEnd', openEnd)
    // console.log('options', options)
    newBlocks.push({
      index: blockIndex,
      type: transformType,
      options,
      context,
      /* Open Tag */
      open: {
        value: openValue,
        start: openStart,
        end: openEnd
      },
      /* Inner Content */
      content: {
        value: content,
        start: contentStart,
        end: contentEnd,
        indentation: findMinIndent(content),
      },
      /* Close Tag */
      close: {
        value: closeTag,
        start: contentEnd,
        end: closeEnd
      },
      /* Full Block */
      block: {
        indentation: finIndentation,
        lines: [lineOpen, lineClose],
        start: openStart,
        end: closeEnd,
        // position: [ commentMatches.index, regexToUse.lastIndex ],
        // rawType: (context.isLegacy) ? type.replace(/^\s?\(/, '') : type,
        rawArgs: paramString,
        rawContent: getTextBetweenChars(contents, contentStart, contentEnd),
        value: block,
      },
    })
  }

  // console.log('newBlocks', newBlocks)

  // let index = 0
  // while ((commentMatches = regexToUse.exec(contents)) !== null) {
  //   index++
  //   let props = {}
  //   let paramString = ''
  //   const [ block, spaces, __type, params ] = commentMatches
  //   const isMultiline = block.indexOf('\n') > -1
  //   let context = {
  //     isMultiline,
  //   }
  //   // console.log('commentMatches', commentMatches)
  //   const indentation = spaces || ''
  //   /* Remove trailing -- if no params */
  //   const type = __type.replace(/-*$/, '')
  //   /*
  //   console.log('index', commentMatches.index)
  //   console.log('block', block)
  //   console.log('type', type)
  //   console.log('params', params)
  //   console.log('spaces', `"${spaces}"`)
  //   /** */
  //   // This is necessary to avoid infinite loops
  //   if (commentMatches.index === regexToUse.lastIndex) {
  //     regexToUse.lastIndex++
  //   }

  //   openTagRegex = getOpenCommentRegex(open, openComment, closeComment)
  //   // console.log('openTagRegex', openTagRegex)
  //   const openingTag = getOpeningTags(block, {
  //     pattern: openTagRegex, 
  //     open: openComment, 
  //     close: closeComment
  //   })
  //   closeTagRegex = getClosingCommentRegex(close, openComment, closeComment)
  //   // console.log('closeTagRegex', closeTagRegex)
  //   const closingTag = getClosingTags(block, {
  //     pattern: closeTagRegex
  //   })
  //   /*
  //   console.log('openingTag', openingTag)
  //   console.log('closingTag', closingTag)
  //   /** */
  //   if (!openingTag || !closingTag) {
  //     continue;
  //   }
    
  //   const openingTagLength = openingTag.length //+ indentation.length
  //   const contentEndPosition = block.indexOf(closingTag.tag, openingTagLength)
  //   const content = getTextBetweenChars(block, openingTagLength, contentEndPosition)
  //   // console.log('content', content)
  //   let originalContent = content
  //   const contentEndsWithNewLine = getLastCharacter(originalContent) === '\n'
  //   const openEndsWithNewLine = getLastCharacter(openingTag.tag) === '\n'

  //   const closeTag = (contentEndsWithNewLine) ? `\n${closingTag.tag}` : closingTag.tag

  //   // Move new line to beginning of closing tag
  //   // if (originalContent.match(/\n$/)) {
  //   if (contentEndsWithNewLine) {
  //     // originalContent = originalContent.replace(/\n$/, '')
  //     originalContent = originalContent.slice(0, -1)
  //   }
  //   /* Strip indentation */
  //   originalContent = stripIndent(originalContent, indentation.length)
  //   // originalContent = originalContent.replace(/^\s+|\s+$/g, '')
  //   /*
  //   console.log('originalContent')
  //   console.log(`"${originalContent}"`)
  //   /** */
    
  //   /* strip brackets (functionName) or [functionName] or {functionName} */
  //   const cleanType = stripBrackets(type)
  //   const shift = (openEndsWithNewLine) ? 1 : 0
  //   const lineOpen = contents.substr(0, commentMatches.index).split('\n').length
  //   const lineClose = contents.substr(0, regexToUse.lastIndex).split('\n').length
  //   const contentStart = commentMatches.index + openingTag.tag.length - shift //+ indentation.length
  //   /* If single line comment block, remove indentation */
  //   const finIndentation = (lineOpen === lineClose) ? '' : indentation
  //   const contentEnd = contentStart + content.length + finIndentation.length + shift
    
  //   // if (cleanType && !cleanType.match(/^-+/)) {
  //   if (cleanType && getFirstCharacter(cleanType) !== '-') {
  //     // console.log('params', params)
  //     // const paramValue = params.match(/([\s\S]*?)-->/gm)
  //     const paramValue = params.match(paramsRegex)
  //     // console.log('paramValue', paramValue)
  //     if (paramValue) {
  //       // paramString = paramValue[0].replace(/-*>$/, '').trim()
  //       paramString = paramValue[0].replace(trimRegex, '').trim()
  //       // console.log('clean', `${cleanType}`)
  //       // console.log('param', `${paramString}`)
  //       // console.log('type ', `${__type}`)
  //       // console.log('──────────────────────')
  //       // console.log(`${cleanType} "${paramString}" "${__type}"`)
  //       if (paramString) {
  //         // console.log('paramString', `"${paramString}"`)
  //         // Legacy v1 options parser
  //         if (getFirstCharacter(paramString) === ':' || getFirstCharacter(paramString) === '?') {
  //           context.isLegacy = true
  //           // paramString = paramString.replace(/\s?\)\s*$/, '').substring(1)
  //           paramString = paramString.split(')')[0].substring(1)
  //           // console.log('fixed paramString', paramString)
  //           props = legacyParseOptions(paramString)
  //         } else {
  //           if (type.startsWith('(') && paramString.endsWith(')')) {
  //             paramString = paramString.replace(/\)$/, '')
  //           }
  //           props = optionsParse(paramString)
            
  //         }
  //       } else if (!paramString && __type.match(/^\(.*\)$/)) {
  //         context.isLegacy = true
  //       }
  //     } 
  //     /*
  //     console.log(regexToUse)
  //     console.log(`cleanType "${cleanType}" at ${regexToUse.lastIndex} using props:`)
  //     console.log(props)
  //     console.log('───────────────────────')
  //     /** */
  //   }

  //   /* Add found block */
  //   blocks.push({
  //     index: index,
  //     type: cleanType,
  //     options: props,
  //     context,
  //     /* Open Tag */
  //     open: {
  //       value: openingTag.tag,
  //       start: commentMatches.index,
  //       end: contentStart
  //     },
  //     /* Inner Content */
  //     content: {
  //       value: originalContent,
  //       start: contentStart,
  //       end: contentEnd,
  //       indentation: findMinIndent(originalContent),
  //     },
  //     /* Close Tag */
  //     close: {
  //       value: closeTag,
  //       start: contentEnd,
  //       end: regexToUse.lastIndex
  //     },
  //     /* Full Block */
  //     block: {
  //       indentation: finIndentation,
  //       lines: [lineOpen, lineClose],
  //       start: commentMatches.index,
  //       end: regexToUse.lastIndex,
  //       // position: [ commentMatches.index, regexToUse.lastIndex ],
  //       rawType: (context.isLegacy) ? type.replace(/^\s?\(/, '') : type,
  //       rawArgs: paramString,
  //       rawContent: getTextBetweenChars(contents, contentStart, contentEnd),
  //       value: block,
  //     },
  //   })
  // }

  return {
    // Close but no single line newPattern: newGetBlockRegex({ openComment, commentClose, start: START, ending: END }),
    // pattern: regexToUse,
    pattern: newerRegex,
    // COMMENT_OPEN_REGEX: openTagRegex,
    // COMMENT_CLOSE_REGEX: closeTagRegex,
    COMMENT_OPEN_REGEX: patterns.openPattern,
    COMMENT_CLOSE_REGEX: patterns.closePattern,
    blocks: newBlocks
  }
}

function verifyTagsBalanced(str, open, close) {
  const openCount = (str.match(open) || []).length
  const closeCount = (str.match(close) || []).length
  return {
    isBalanced: openCount === closeCount,
    openCount,
    closeCount
  }
}

/**
 * Strip brackets from string (functionName) or [functionName] or {functionName}
 * @param {string} str 
 * @returns {string}
 */
function stripBrackets(str) {
  return str.replace(/[(\[\{]*([A-Z-a-z0-9_$-]*)[)\]\}]*/, '$1')
}

function legacyParseOptions(options) {
  const returnOptions = {}
  if (!options) {
    return returnOptions
  }
  options.split('&').map((opt, i) => { // eslint-disable-line
    const getValues = opt.split(/=(.+)/)
    if (getValues[0] && getValues[1]) {
      returnOptions[getValues[0]] = getValues[1]
    }
  })
  return returnOptions
}


/* TODO someday Named matches
(?<leading>[ \t]*)(?:<!-{2,}(?:.*|\r?|\n?|\s*)MD-MAGIC-EXAMPLE:START\s*(?<key>[(\[\{]*[A-Za-z0-9_$-]*[)\]\}]*)\s*)([\s\S]*?)-->(?<content>(?:.*?|.*?\r?\n?)*?)<!-{2,}(?:.*|\r?|\n?|\s*)MD-MAGIC-EXAMPLE:END(?:.|\r?\n)*?-{2,}>
*/

/**
 * Get Regex pattern to match block
 * @param {object} options
 * @param {string} [options.openComment] - comment syntax open
 * @param {string} [options.closeComment] - comment syntax open
 * @param {string} [options.openText] - comment open text
 * @param {string} [options.closeText] - comment close text
 * @returns {RegExp}
 */
function getBlockRegex({
  openEmoji,
  openComment,
  closeComment, 
  openText, 
  closeText,
  allowMissingTransforms = false
}) {
  // https://regex101.com/r/SU2g1Q/1
  // https://regex101.com/r/SU2g1Q/2
  // https://regex101.com/r/SU2g1Q/3
  // https://regex101.com/r/SU2g1Q/4
  // https://regex101.com/r/SU2g1Q/5
  // https://regex101.com/r/SU2g1Q/6
  // /([ \t]*)(<!-{2,}(?:.|\r?|\n?|\s*)\bdoc-gen\b)((?:.|\r?\n)*?)-{2,}>([\s\S]*?.*)\n?<!-{2,}(?:.*|\r?|\n?|\s*)end-doc-gen(?:.|\r?\n)*?-{2,}>/gim
  // /([ \t]*)(<!-{2,}(?:\r?|\n?|\s*)\bdoc-gen\b)\s*([(\[\{]*[A-Za-z0-9_$-]*[)\]\}]*)\s*((?:.|\r?\n)*?)-{2,}>([\s\S]*?.*)\n?<!-{2,}(?:.*|\r?|\n?|\s*)end-doc-gen(?:.|\r?\n)*?-{2,}>/
  const emojiPat = (openEmoji) ? `(?:\\s*${openEmoji})?` : '(?:\\s*⛔️)?'
  const boundary = openText.indexOf('/') > -1 ? '' : '\\b'
  const matchWord = `${boundary}${openText}${boundary}`
  const hasOne = (allowMissingTransforms) ? '*' : '+'
  const open = `((?:${openComment}${emojiPat}(?:\\r?|\\n?|\\s*)${matchWord})\\s*[(\\[\\{]*([A-Za-z0-9_$]${hasOne})[)\\]\\}]*\\s*((?:.|\\r?\\n)*?)${closeComment}\\n?)`
  const close = `(\\n?[ \\t]*${openComment}${emojiPat}(?:\\r?|\\n?|\\s*)${closeText}(?:.|\\r?\\n)*?${closeComment})`
  // const close = `(\\n?${openComment}(?:.*|\\r?|\\n?|\\s*)${closeText}(?:.|\\r?\\n)*?${closeComment})`
  const blockPattern = new RegExp(`([ \\t]*)${open}([\\s\\S]*?.*)${close}`, 'gmi')
  const openPattern = new RegExp(open, 'gi')
  const closePattern = new RegExp(close, 'gi')

  return {
    blockPattern,
    openPattern,
    closePattern
  }
}

// function getOpeningTags(block, {
//   pattern, 
//   open,
//   close
// }) {
//   // console.log(block.match(/^\/\*+(.*)\*\//))
//   // console.log('openTagRegex', pattern)
//   let matches
//   while ((matches = pattern.exec(block)) !== null) {
//     if (matches.index === pattern.lastIndex) {
//       pattern.lastIndex++  // avoid infinite loops with zero-width matches
//     }
//     const [ tag, spaces, tagStart, tagEnd ] = matches
//     /*
//     console.log('FULL Open Tag >>>>>', tag)
//     console.log('openTag Start', "'"+tagStart+"'");
//     console.log('openTag End', "'"+tagEnd+"'");
//     /**/
//     return {
//       tag,
//       spaces: spaces || '',
//       length: tag.length,
//       tagStart,
//       tagEnd,
//     }
//   }
// }

// function getClosingTags(block, {
//   pattern, 
//   // open,
//   // close
// }) {
//   // console.log('closeTagRegex', closeTagRegex)
//   let matches
//   while ((matches = pattern.exec(block)) !== null) {
//     if (matches.index === pattern.lastIndex) {
//       pattern.lastIndex++ // avoid infinite loops with zero-width matches
//     }
//     const [ _tag, spaces, tagStart, tagEnd] = matches
//     /*
//     console.log('FULL CLOSE Tag >>>>>', matches[0])
//     console.log('closeTag Start', "'"+matches[1]+"'");
//     console.log('closeTag End', "'"+matches[2]+"'");
//     /**/
//     const tag = spaces + tagStart + tagEnd
//     return {
//       tag: tag,
//       length: tag.length,
//       spaces: spaces || '',
//       tagStart,
//       tagEnd
//     }
//   }
// }

// /**
//  * Get Regex pattern to match block
//  * @param {object} options
//  * @param {string} [options.openComment] - comment syntax open
//  * @param {string} [options.closeComment] - comment syntax open
//  * @param {string} [options.openText] - comment open text
//  * @param {string} [options.closeText] - comment close text
//  * @returns {RegExp}
//  */
// function getBlockRegexOld({ openComment, closeComment, openText, closeText }) {
//   // /([ \t]*)(<!-{2,}(?:.|\r?|\n?|\s*)\bdoc-gen\b)((?:.|\r?\n)*?)-{2,}>(.*)<!-{2,}(?:.*|\r?|\n?|\s*)end-doc-gen(?:.|\r?\n)*?-{2,}>/i singleline
//   return new RegExp(
//     `([ \\t]*)(?:${openComment}(?:.*|\\r?|\\n?|\\s*)${openText}\\s*([(\\[\\{]*[A-Za-z0-9_$-]*[)\\]\\}]*)\\s*)((?:.*?|.*?\\r?\\n?)*?)${openComment}(?:.*|\\r?|\\n?|\\s*)${closeText}(?:.|\\r?\\n)*?${closeComment}`,
//     'gmi'
//   )
// }


// function newGetBlockRegex({ commentOpen, commentClose, start, ending }) {
//   // https://regex101.com/r/C9WSk8/1 close but breaks on single line blocks. Maybe needs lookahead https://stackoverflow.com/questions/7124778/how-can-i-match-anything-up-until-this-sequence-of-characters-in-a-regular-exp
//   return new RegExp(
//     `([ \\t]*)(?:${commentOpen}(?:.*|\\r?|\\n?|\\s*)${start}\\s*([(\\[\\{]*[A-Za-z0-9_$-]*[)\\]\\}]*)\\s*)([\\s\\S]*?)${commentClose}((?:.*?|.*?\\r?\\n?)*?)${commentOpen}(?:.*|\\r?|\\n?|\\s*)${ending}(?:.|\\r?\\n)*?${commentClose}`,
//     'gmi'
//   )
// }

// function getOpenCommentRegex(word, open, close) {
//   // console.log('open', open)
//   const boundary = word.indexOf('/') > -1 ? '' : '\\b'
//   // console.log('boundary', boundary)
//   // return new RegExp(`(\\<\\!--(?:.|\\r?\\n)*?${matchWord}:START)((?:.|\\r?\\n)*?--\\>)`, 'g')
//   return new RegExp(`([ \\t]*)(${open}(?:.|\r?|\n?|\\s*)${boundary}${word}${boundary})((?:.|\\r?\\n)*?${close}\n?)`, 'gi')
// }

// function getClosingCommentRegex(word, open, close) {
//   const boundary = word.indexOf('/') > -1 ? '' : '\\b'
//   return new RegExp(`${close}(?:.|\\r?\\n)*?([ \t]*)((?:${open}(?:.*|\\r?\\n)(?:.*|\\r?\\n))*?${boundary}${word}${boundary})((?:.|\\r?\\n)*?${close})`, 'gi')
//   // return new RegExp(`--\\>(?:.|\\r?\\n)*?([ \t]*)((?:\\<\\!--(?:.*|\\r?\\n)(?:.*|\\r?\\n))*?${word}:END)((?:.|\\r?\\n)*?--\\>)`, 'gi')
// }

module.exports = {
  getBlockRegex,
  getBlockRegex,
  parseBlocks,
}