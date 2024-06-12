'use strict'

/**
 * `isMemberOrInvitee` policy.
 */

module.exports = async (ctx, next) => {
  const body = ctx.request.body
  const urlComponents = ctx.request.url.split('/')
  const contentType = urlComponents[1].replace(/s$/, '')
  const id = urlComponents.length > 2 ? parseInt(urlComponents[2], 10) : null
  let object = await strapi.services[contentType].findOne({ id })

  if (contentType === 'shared-artifact') {
    if (!object) {
      return ctx.notFound()
    }

    object = await strapi.services['shared-portfolio'].findOne({ id: object.sharedPortfolio.id })
  }

  const members = object.members.map(user => user.id)

  if (ctx.state.user.role.type === 'researcher') {
    members.push(ctx.state.user.id)
  }

  if (!members.includes(ctx.state.user.id)) {
    const invitation = await strapi.services.invitation.findOne({ sharedPortfolio: object.id, to: ctx.state.user.id })

    if (!invitation) {
      return ctx.forbidden()
    }
  }

  await next()
}
