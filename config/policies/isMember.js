'use strict'

/**
 * `isMember` policy.
 */

module.exports = async (ctx, next) => {
  const body = ctx.request.body
  const urlComponents = ctx.request.url.split('/')
  const contentType = urlComponents[1].replace(/s$/, '')
  const id = urlComponents.length > 2 ? parseInt(urlComponents[2], 10) : null
  let sharedPortfolio

  if (contentType === 'artifact') {
    sharedPortfolio = await strapi.services['shared-portfolio'].findOne({ id: body.sharedPortfolioId })

    if (!sharedPortfolio) {
      return ctx.notFound('Invalid shared portfolio ID.')
    }
  }

  else if (!id) {
    const sharedArtifact = await strapi.services['shared-artifact'].findOne({ id: body.sharedArtifact })

    if (!sharedArtifact) {
      return ctx.notFound('Invalid shared artifact ID.')
    }

    sharedPortfolio = await strapi.services['shared-portfolio'].findOne({ id: sharedArtifact.sharedPortfolio.id })

    if (!sharedPortfolio) {
      return ctx.badImplementation('Object belongs to an invalid shared portfolio.')
    }
  }

  else if (contentType === 'shared-portfolio') {
    sharedPortfolio = await strapi.services['shared-portfolio'].findOne({ id })
  }

  else {
    const object = await strapi.services[contentType].findOne({ id })

    if (!object) {
      return ctx.notFound()
    }

    if (contentType === 'shared-portfolio') {
      sharedPortfolio = object
    }

    else {
      const sharedPortfolioId = (contentType === 'shared-artifact') ? object.sharedPortfolio.id : object.sharedArtifact.sharedPortfolio
      sharedPortfolio = await strapi.services['shared-portfolio'].findOne({ id: sharedPortfolioId })

      if (!sharedPortfolio) {
        return ctx.badImplementation('Object belongs to an invalid shared portfolio.')
      }
    }
  }

  let members = sharedPortfolio.members.map(user => user.id)

  if (ctx.state.user.role.type === 'researcher') {
    members.push(ctx.state.user.id)
  }

  if (!members.includes(ctx.state.user.id)) {
    return ctx.forbidden()
  }

  if (ctx.request.method === 'DELETE' && contentType === 'shared-artifact') {
    const sharedArtifact = await strapi.services['shared-artifact'].findOne({ id })

    if (sharedArtifact.comments.length > 0 || sharedArtifact.reactions.length > 0) {
      return ctx.badRequest('You cannot delete a shared artifact with comments or reactions.')
    }
  }

  await next()
}
