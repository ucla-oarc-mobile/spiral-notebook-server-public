'use strict'

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  isComplete(artifact) {
    const keys = artifact.structure.filter(question => (
      question.type !== 'fileUpload'
    )).map(question => question.key)

    return keys.every(key => artifact.responses[key])
  },
  getNextLetter(letter) {
    if (!letter) {
      return 'A'
    }

    let firstLetter = letter.length === 1 ? '' : letter[0]
    let lastLetter = letter.slice(-1)

    if (lastLetter !== 'Z') {
      lastLetter = String.fromCharCode(lastLetter.charCodeAt(0) + 1)
    }

    else {
      lastLetter = 'A'

      if (!firstLetter) {
        firstLetter = 'A'
      }
      else {
        firstLetter = String.fromCharCode(firstLetter.charCodeAt(0) + 1)
      }
    }

    return firstLetter + lastLetter
  },
}
