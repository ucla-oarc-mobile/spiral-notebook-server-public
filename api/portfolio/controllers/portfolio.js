'use strict'

const { sanitizeEntity } = require('strapi-utils')
const { stringify } = require('csv-stringify/sync')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    let entities
    let params = ctx.query

    if (ctx.state.user.role.type !== 'researcher') {
      params.owner = ctx.state.user.id
    }

    if (ctx.query._q) {
      entities = await strapi.services.portfolio.search(params)
    } else {
      entities = await strapi.services.portfolio.find(params)
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models.portfolio })).map(portfolio => ({
      ...portfolio,
      artifacts: portfolio.artifacts.filter(artifact => artifact.structure),
    }))
  },
  async exportAll(ctx) {
    const portfolios = await strapi.services.portfolio.find()
    let rows = [[
      'Teacher',
      'Portfolio',
      'Artifacts',
      'Parking Lot Artifacts',
      'Completed Artifacts',
      'Artifacts with Documents',
      'Artifacts with Images',
      'Artifacts with Videos',
      'Documents',
      'Images',
      'Videos',
      'Last Updated',
    ]]

    portfolios.forEach((portfolio) => {
      if (portfolio.owner.role !== 1) {
        return
      }

      let parkingLot = 0
      let completed = 0
      let withDocuments = 0
      let withImages = 0
      let withVideos = 0
      let totalDocuments = 0
      let totalImages = 0
      let totalVideos = 0
      let lastUpdated = new Date(portfolio.updated_at)

      const artifacts = portfolio.artifacts.filter(artifact => artifact.structure)

      artifacts.forEach((artifact) => {
        if (artifact.parkingLot) {
          ++parkingLot
        }

        if (strapi.models.artifact.isComplete(artifact)) {
          ++completed
        }

        if (artifact.documents.length) {
          ++withDocuments
          totalDocuments += artifact.documents.length
        }

        if (artifact.images.length) {
          ++withImages
          totalImages += artifact.images.length
        }

        if (artifact.videos.length) {
          ++withVideos
          totalVideos += artifact.videos.length
        }

        const newUpdated = new Date(artifact.updated_at)
        if (newUpdated > lastUpdated) {
          lastUpdated = newUpdated
        }
      })

      rows.push([
        portfolio.owner.username,
        portfolio.name,
        artifacts.length,
        parkingLot,
        completed,
        withDocuments,
        withImages,
        withVideos,
        totalDocuments,
        totalImages,
        totalVideos,
        lastUpdated.toLocaleString(),
      ])
    })

    ctx.type = 'text/csv; charset=utf-8'
    ctx.attachment('teacher portfolios.csv')
    ctx.body = stringify(rows)
  },
  async findOne(ctx) {
    const { id } = ctx.params

    const entity = await strapi.services.portfolio.findOne({ id })
    entity.artifacts = entity.artifacts.filter(artifact => artifact.structure)

    return sanitizeEntity(entity, { model: strapi.models.portfolio })
  },
  async create(ctx) {
    const { body } = ctx.request
    const template = await strapi.services.portfolio.findOne({ id: 1 })
    const params = {
      ...body,
      owner: ctx.state.user.id,
      structure: template.structure,
    }

    const entity = await strapi.services.portfolio.create(params)
    return sanitizeEntity(entity, { model: strapi.models.portfolio })
  },
}
