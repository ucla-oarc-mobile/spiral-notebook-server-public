'use strict'

/**
 * `isOwner` policy.
 */

module.exports = async (ctx, next) => {
  const body = ctx.request.body
  const urlComponents = ctx.request.url.split('/')
  const contentType = urlComponents[1].replace(/s$/, '')
  const id = parseInt(urlComponents[2], 10)
  let object
  let ownerIds = []

  if (id) {
    object = await strapi.services[contentType].findOne({ id })

    if (!object) {
      return ctx.notFound()
    }
  }

  if (contentType === 'artifact') {
    ownerIds = [object.portfolio.owner]
  }

  else if (contentType === 'invitation') {
    if (!id) {
      const sharedPortfolio = await strapi.services['shared-portfolio'].findOne({ id: body.sharedPortfolio })
      if (!sharedPortfolio) {
        return ctx.notFound('Invalid shared portfolio ID.')
      }
      ownerIds = [sharedPortfolio.owner.id]
    }
    else if (urlComponents[3] === 'accept') {
      ownerIds = [object.to.id]
    }
    else {
      ownerIds = [object.to.id, object.sharedPortfolio.owner]
    }
  }

  else if (contentType === 'portfolio' && id === 1) {
    ownerIds = [ctx.state.user.id]
  }

  else {
    ownerIds = [object.owner.id]
  }

  if (ctx.request.method === 'GET' && ctx.state.user.role.type === 'researcher') {
    ownerIds.push(ctx.state.user.id)
  }

  if (!ownerIds.includes(ctx.state.user.id)) {
    return ctx.forbidden()
  }

  await next()
}
