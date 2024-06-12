'use strict'

const { sanitizeEntity } = require('strapi-utils')
const emoji = ['🔖', '⭐', '🌉', '❓']

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    let portfolios = await strapi.services['shared-portfolio'].find()
          portfolios = portfolios.filter(p => p.members.map(m => m.id).includes(ctx.state.user.id))
          const portfolioIds = portfolios.map(p => p.id)
          const artifacts = await strapi.services['shared-artifact'].find({ sharedPortfolio_in: portfolioIds })
          const artifactIds = artifacts.map(a => a.id)
          const entities = await strapi.services.reaction.find({ sharedArtifact_in: artifactIds })

    const sanitized = entities.map(entity => sanitizeEntity(entity, { model: strapi.models.reaction }))
          return sanitized.map((c) => {
                  const { structure, responses, images, videos, documents, ...rest } = c.sharedArtifact
                  return {
                        ...c,
                        sharedArtifact: rest
                }
        })
  },
  async findOne(ctx) {
    const { id } = ctx.params
    let entity = await strapi.services.reaction.findOne({ id })
    let sanitized = sanitizeEntity(entity, { model: strapi.models.reaction })
	const { structure, responses, images, videos, documents, ...rest } = sanitized.sharedArtifact
	  return {
		  ...sanitized,
		  sharedArtifact: rest
	  }
  },
  async create(ctx) {
    const { body } = ctx.request
    const params = {
	    sharedArtifact: body.sharedArtifact,
	    value: body.value,
      owner: ctx.state.user.id,
    }

	  const artifact = await strapi.services['shared-artifact'].findOne({ id: params.sharedArtifact })
	  if (!params.sharedArtifact || !artifact) {
		  return ctx.badRequest('Invalid shared artifact ID.')
	  }
	  else if (!emoji.includes(params.value)) {
		  console.log(params.value, params.value.charCodeAt(0), params.value.charCodeAt(1))
		  return ctx.badRequest('Invalid reaction value.')
	  }

	  let entity = await strapi.services.reaction.findOne(params)
	  if (!entity) {
            entity = await strapi.services.reaction.create(params)
	  }
    let sanitized = sanitizeEntity(entity, { model: strapi.models.reaction })
	const { structure, responses, images, videos, documents, ...rest } = sanitized.sharedArtifact

	  return {
		  ...sanitized,
		  sharedArtifact: rest
	  }
  },
  async update(ctx) {
    const { id } = ctx.params
	  const { body } = ctx.request
  const params = {
	  value: body.value
    }

    const entity = await strapi.services.reaction.update({ id }, params)
    let sanitized = sanitizeEntity(entity, { model: strapi.models.reaction })
	const { structure, responses, images, videos, documents, ...rest } = sanitized.sharedArtifact

	  return {
		  ...sanitized,
		  sharedArtifact: rest
	  }
  },
  async delete(ctx) {
    const { id } = ctx.params

    const entity = await strapi.services.reaction.delete({ id })
    let sanitized = sanitizeEntity(entity, { model: strapi.models.reaction })
	const { structure, responses, images, videos, documents, ...rest } = sanitized.sharedArtifact

	  return {
		  ...sanitized,
		  sharedArtifact: rest
	  }
  },
  async available(ctx) {
    return emoji
  },
}
