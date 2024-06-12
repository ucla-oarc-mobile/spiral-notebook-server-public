'use strict'

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  isBonusComplete(sharedArtifact) {
    const keys = sharedArtifact.structure.filter(question => (
      question.bonus
    )).map(question => question.key)

    return keys.every(key => sharedArtifact.responses[key])
  },
}
