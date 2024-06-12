'use strict'

const { sanitizeEntity } = require('strapi-utils')
const fetch = require('node-fetch')

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
    const entities = await strapi.services.comment.find({ sharedArtifact_in: artifactIds })

    const sanitized = entities.map(entity => sanitizeEntity(entity, { model: strapi.models.comment }))
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
    let entity = await strapi.services.comment.findOne({ id })
    let sanitized = sanitizeEntity(entity, { model: strapi.models.comment })
    const { structure, responses, images, videos, documents, ...rest } = sanitized.sharedArtifact
    return {
      ...sanitized,
      sharedArtifact: rest
    }
  },
  async create(ctx) {
    const { body } = ctx.request
    const params = {
      ...body,
      owner: ctx.state.user.id,
    }

    const entity = await strapi.services.comment.create(params)
    let sanitized = sanitizeEntity(entity, { model: strapi.models.comment })
    sanitized.sharedArtifactComments = await strapi.services.comment.find({ sharedArtifact: sanitized.sharedArtifact.id })

    const artifact = await strapi.services['shared-artifact'].findOne({ id: sanitized.sharedArtifact.id })
    const portfolio = await strapi.services['shared-portfolio'].findOne({ id: artifact.sharedPortfolio.id })
    const emails = portfolio.members.map(u => u.email).filter(email => email !== ctx.state.user.email)
    sanitized.sharedPortfolioCommentCount = await strapi.services.comment.count({ sharedArtifact_in: portfolio.sharedArtifacts.map(a => a.id) })
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
      text: body.text
    }

    const entity = await strapi.services.comment.update({ id }, params)
    let sanitized = sanitizeEntity(entity, { model: strapi.models.comment })
    sanitized.sharedArtifactComments = await strapi.services.comment.find({ sharedArtifact: sanitized.sharedArtifact.id })

    const artifact = await strapi.services['shared-artifact'].findOne({ id: sanitized.sharedArtifact.id })
    const portfolio = await strapi.services['shared-portfolio'].findOne({ id: artifact.sharedPortfolio.id })
    sanitized.sharedPortfolioCommentCount = await strapi.services.comment.count({ sharedArtifact_in: portfolio.sharedArtifacts.map(a => a.id) })
    const { structure, responses, images, videos, documents, ...rest } = sanitized.sharedArtifact

    return {
      ...sanitized,
      sharedArtifact: rest
    }
  },
  async delete(ctx) {
    const { id } = ctx.params

    const entity = await strapi.services.comment.delete({ id })
    let sanitized = sanitizeEntity(entity, { model: strapi.models.comment })
    sanitized.sharedArtifactComments = await strapi.services.comment.find({ sharedArtifact: sanitized.sharedArtifact.id })

    const artifact = await strapi.services['shared-artifact'].findOne({ id: sanitized.sharedArtifact.id })
    const portfolio = await strapi.services['shared-portfolio'].findOne({ id: artifact.sharedPortfolio.id })
    sanitized.sharedPortfolioCommentCount = await strapi.services.comment.count({ sharedArtifact_in: portfolio.sharedArtifacts.map(a => a.id) })
    const { structure, responses, images, videos, documents, ...rest } = sanitized.sharedArtifact

    return {
      ...sanitized,
      sharedArtifact: rest
    }
  },
}
