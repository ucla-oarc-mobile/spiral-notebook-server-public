'use strict'

const { parseMultipartData, sanitizeEntity } = require('strapi-utils')
const FileType = require('file-type')
const fs = require('fs')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    let entities
    const portfolios = await strapi.services.portfolio.find({ owner: ctx.state.user.id })

    const query = {
      ...ctx.query,
      structure_null: false,
      portfolio_in: portfolios.map(portfolio => portfolio.id),
    }

    if (ctx.query._q) {
      entities = await strapi.services.artifact.search(query)
    } else {
      entities = await strapi.services.artifact.find(query)
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models.artifact })).map(artifact => ({
      ...artifact,
      portfolio: artifact.portfolio ? artifact.portfolio.id : null
    }))
  },
	async createInPortfolio(ctx) {
		const { body } = ctx.request
		let params = {
			portfolio: ctx.params.id
		}

		if (body.hasOwnProperty('parkingLot')) {
			params.parkingLot = body.parkingLot ? true : false
		}
		if (Array.isArray(body.structure) && body.structure.length > 0) {
			params.structure = body.structure
		}
		if (typeof body.responses === 'object') {
			params.responses = body.responses
		}

		let entity = await strapi.services.artifact.create(params)
		return sanitizeEntity(entity, { model: strapi.models.artifact })
	},
	async updateInPortfolio(ctx) {
		const { body } = ctx.request
		const artifact = await strapi.services.artifact.findOne({ id: ctx.params.artifactId })
		let params = {}

		if (body.hasOwnProperty('parkingLot')) {
			params.parkingLot = body.parkingLot ? true : false
		}
		if (Array.isArray(body.structure) && body.structure.length > 0) {
			params.structure = body.structure
		}
		if (typeof body.responses === 'object') {
			params.responses = artifact.responses || {}

			Object.keys(body.responses).forEach((key) => {
				if (body.responses[key] === null) {
					delete params.responses[key]
				}
				else {
					params.responses[key] = body.responses[key]
				}
			})
		}

		let entity = await strapi.services.artifact.update({ id: ctx.params.artifactId }, params)
		return sanitizeEntity(entity, { model: strapi.models.artifact })
	},
	async createDocument(ctx) {
		const { files } = ctx.request
		const file = files[Object.keys(files)[0]]
		if (file.size === 0) {
			return ctx.badRequest('You cannot upload an empty file.')
		}
		const detectedType = await FileType.fromFile(file.path)
		const outty = await strapi.plugins.upload.services.upload.upload({ data: {
			refId: ctx.params.artifactId,
			ref: 'artifact',
			field: 'documents'
		}, files: {
			name: file.name,
			path: file.path,
			type: detectedType ? detectedType.mime : file.type,
			size: file.size
		}})

		let artifact = await strapi.services.artifact.findOne({ id: ctx.params.artifactId })
		let res = Array.isArray(outty) ? outty[0] : outty
		await strapi.plugins.upload.services.upload.updateFileInfo(res.id, { caption: artifact.nextCaption })
		res.caption = artifact.nextCaption

		const nextLetter = strapi.models.artifact.getNextLetter(artifact.nextCaption)
		await strapi.services.artifact.update({ id: ctx.params.artifactId }, { nextCaption: nextLetter })
		artifact.nextCaption = nextLetter

		return {
			...res,
			parentArtifact: artifact,
		}
	},
	async deleteDocument(ctx) {
		const artifact = await strapi.services.artifact.findOne({ id: ctx.params.artifactId })
		const fileIds = artifact.documents.map(f => f.id)
		const updated = await strapi.services.artifact.update({ id: artifact.id }, {
			documents: fileIds.filter(i => i.toString() !== ctx.params.documentId)
		})
		const file = await strapi.plugins.upload.services.upload.fetch({ id: ctx.params.documentId })

		return {
			...file,
			parentArtifact: updated,
		}
	},
	async createImage(ctx) {
		const { files } = ctx.request
                const file = files[Object.keys(files)[0]]
		if (file.size === 0) {
			return ctx.badRequest('You cannot upload an empty file.')
		}
		const detectedType = await FileType.fromFile(file.path)
                const outty = await strapi.plugins.upload.services.upload.upload({ data: {
                        refId: ctx.params.artifactId,
                        ref: 'artifact',
                        field: 'images'
                }, files: {
                        name: file.name,
                        path: file.path,
			type: detectedType ? detectedType.mime : file.type,
                        size: file.size
                }})

		let artifact = await strapi.services.artifact.findOne({ id: ctx.params.artifactId })
		let res = Array.isArray(outty) ? outty[0] : outty
		await strapi.plugins.upload.services.upload.updateFileInfo(res.id, { caption: artifact.nextCaption })
		res.caption = artifact.nextCaption

		const nextLetter = strapi.models.artifact.getNextLetter(artifact.nextCaption)
		await strapi.services.artifact.update({ id: ctx.params.artifactId }, { nextCaption: nextLetter })
		artifact.nextCaption = nextLetter

		return {
			...res,
			parentArtifact: artifact,
		}
	},
	async deleteImage(ctx) {
		const artifact = await strapi.services.artifact.findOne({ id: ctx.params.artifactId })
		const fileIds = artifact.images.map(f => f.id)
		const updated = await strapi.services.artifact.update({ id: artifact.id }, {
			images: fileIds.filter(i => i.toString() !== ctx.params.imageId)
		})
		const file = await strapi.plugins.upload.services.upload.fetch({ id: ctx.params.imageId })

		return {
			...file,
			parentArtifact: updated,
		}
	},
	async createVideo(ctx) {
		const { files } = ctx.request
                const file = files[Object.keys(files)[0]]
		if (file.size === 0) {
			return ctx.badRequest('You cannot upload an empty file.')
		}
		const detectedType = await FileType.fromFile(file.path)
                const outty = await strapi.plugins.upload.services.upload.upload({ data: {
                        refId: ctx.params.artifactId,
                        ref: 'artifact',
                        field: 'videos',
                }, files: {
                        name: file.name,
                        path: file.path,
			type: detectedType ? detectedType.mime : file.type,
                        size: file.size
                }})

		let artifact = await strapi.services.artifact.findOne({ id: ctx.params.artifactId })
		let res = Array.isArray(outty) ? outty[0] : outty
		await strapi.plugins.upload.services.upload.updateFileInfo(res.id, { caption: artifact.nextCaption })
		res.caption = artifact.nextCaption

		const nextLetter = strapi.models.artifact.getNextLetter(artifact.nextCaption)
		await strapi.services.artifact.update({ id: ctx.params.artifactId }, { nextCaption: nextLetter })
		artifact.nextCaption = nextLetter

		return {
			...res,
			parentArtifact: artifact,
		}
	},
	async deleteVideo(ctx) {
		const artifact = await strapi.services.artifact.findOne({ id: ctx.params.artifactId })
		const fileIds = artifact.videos.map(f => f.id)
		const updated = await strapi.services.artifact.update({ id: artifact.id }, {
			videos: fileIds.filter(i => i.toString() !== ctx.params.videoId)
		})
		const file = await strapi.plugins.upload.services.upload.fetch({ id: ctx.params.videoId })

		return {
			...file,
			parentArtifact: updated,
		}
	},
	async share(ctx) {
		const { sharedPortfolioId } = ctx.request.body
		const artifact = await strapi.services.artifact.findOne({ id: ctx.params.id })
		const sp = await strapi.services['shared-portfolio'].findOne({ id: sharedPortfolioId })
		let params = {
			...artifact,
			sharedPortfolio: sp.id,
			owner: ctx.state.user.id,
			structure: sp.structure,
			portfolioTopic: artifact.portfolio.topic,
			portfolioSubject: artifact.portfolio.subject,
			portfolioGrades: artifact.portfolio.grades,
		}
		params.images = params.images.map(f => f.id)
		params.videos = params.videos.map(f => f.id)
		params.documents = params.documents.map(f => f.id)

		const entity = await strapi.services['shared-artifact'].create(params)
		return sanitizeEntity(entity, { model: strapi.models['shared-artifact'] })
	},
}
