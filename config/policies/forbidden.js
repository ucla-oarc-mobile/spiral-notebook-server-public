'use strict'

/**
 * `forbidden` policy.
 */

module.exports = async (ctx, next) => {
  return ctx.forbidden()
}
