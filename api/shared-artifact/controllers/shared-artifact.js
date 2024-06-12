'use strict'

const { sanitizeEntity } = require('strapi-utils')
const FileType = require('file-type')
const uuid = require('uuid')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    let portfolios = await strapi.services['shared-portfolio'].find()
	  portfolios = portfolios.filter(p => p.members.map(m => m.id).includes(ctx.state.user.id))
	  const portfolioIds = portfolios.map(p => p.id)
          const entities = await strapi.services['shared-artifact'].find({ sharedPortfolio_in: portfolioIds })

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models['shared-artifact'] }))
  },
  async findOne(ctx) {
    const { id } = ctx.params

    const entity = await strapi.services['shared-artifact'].findOne({ id })
    let sanitized = sanitizeEntity(entity, { model: strapi.models['shared-artifact'] })

    let usernames = {}
//    const users = await strapi.services.user.find({ id_in: sanitized.comments.map(c => c.owner) })
    const users = await strapi.plugins['users-permissions'].services.user.fetchAll()
    users.forEach((user) => {
      usernames[user.id] = user.username
    })

	sanitized.comments = sanitized.comments.map(c => ({
		...c,
		username: usernames[c.owner],
	}))

    return sanitized
  },
  async gateCheck(ctx) {
    const { updated_at } = ctx.query
    const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
    let lastUpdated = new Date(updated_at)

    if (isNaN(lastUpdated)) {
      lastUpdated = new Date(parseInt(updated_at, 10))
    }

    if (!updated_at || isNaN(lastUpdated)) {
      return {
        type: 'error',
        message: 'Invalid updated_at parameter.',
      }
    }

    else if (!artifact) {
      return {
        type: 'error',
        message: 'Shared artifact not found.',
      }
    }

    else if (artifact.updated_at > lastUpdated) {
      return {
        type: 'warning',
        message: 'This artifact has recently been saved by someone else at ' + artifact.updated_at.toLocaleString() + '.',
      }
    }

    else {
      return {
        type: 'ok',
        message: 'Shared artifact can be safely saved.',
      }
    }
  },
  async lock(ctx) {
    const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })

    if (artifact.lockedUntil) {
      const until = new Date(artifact.lockedUntil)

      if (until > new Date()) {
        return ctx.locked('This artifact is being edited by ' + artifact.lockedBy.username + '. They have exclusive access until ' + until.toLocaleString() + '.')
      }
    }

    const entity = await strapi.services['shared-artifact'].update({ id: ctx.params.artifactId }, {
      lock: uuid.v1(),
      lockedUntil: Date.now() + 1000 * 60 * 15,
      lockedBy: ctx.state.user.id,
    })

    return entity
  },
  async unlock(ctx) {
    const { body } = ctx.request
    const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
    const until = new Date(artifact.lockedUntil)

    // Clear the lock if the code matches or if the lock already expired
    if (!artifact.lockedUntil || until <= new Date() || body.lock === artifact.lock) {
      await strapi.services['shared-artifact'].update({ id: ctx.params.artifactId }, {
        lock: null,
        lockedUntil: null,
        lockedBy: null,
      })

      return {}
    }

    return ctx.badRequest('There was a problem releasing the lock. This artifact can be edited after ' + until.toLocaleString() + '.')
  },
  async updateInPortfolio(ctx) {
    const { body } = ctx.request
    const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
    let params = {}

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

    let entity = await strapi.services['shared-artifact'].update({ id: ctx.params.artifactId }, params)
    return sanitizeEntity(entity, { model: strapi.models['shared-artifact'] })
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
			ref: 'shared-artifact',
			field: 'documents'
		}, files: {
			name: file.name,
			path: file.path,
			type: detectedType ? detectedType.mime : file.type,
			size: file.size
		}})

		let artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
		let res = Array.isArray(outty) ? outty[0] : outty
		await strapi.plugins.upload.services.upload.updateFileInfo(res.id, { caption: artifact.nextCaption })
		res.caption = artifact.nextCaption

		const nextLetter = strapi.models.artifact.getNextLetter(artifact.nextCaption)
		artifact.nextCaption = nextLetter
		await strapi.query('shared-artifact').model.query(qb => (
		  qb.where('id', artifact.id)
		)).save({
		  updated_at: artifact.updated_at,
		  nextCaption: nextLetter,
		}, { patch: true })

		return {
			...res,
			parentSharedArtifact: artifact,
		}
	},
	async deleteDocument(ctx) {
                const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
                const fileIds = artifact.documents.map(f => f.id)
                const updated = await strapi.services['shared-artifact'].update({ id: artifact.id }, {
                        documents: fileIds.filter(i => i.toString() !== ctx.params.documentId)
                })
                const file = await strapi.plugins.upload.services.upload.fetch({ id: ctx.params.documentId })

                return {
                        ...file,
                        parentSharedArtifact: updated,
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
                        ref: 'shared-artifact',
                        field: 'images'
                }, files: {
                        name: file.name,
                        path: file.path,
			type: detectedType ? detectedType.mime : file.type,
                        size: file.size
                }})

		let artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
		let res = Array.isArray(outty) ? outty[0] : outty
		await strapi.plugins.upload.services.upload.updateFileInfo(res.id, { caption: artifact.nextCaption })
		res.caption = artifact.nextCaption

		const nextLetter = strapi.models.artifact.getNextLetter(artifact.nextCaption)
		artifact.nextCaption = nextLetter
		await strapi.query('shared-artifact').model.query(qb => (
		  qb.where('id', artifact.id)
		)).save({
		  updated_at: artifact.updated_at,
		  nextCaption: nextLetter,
		}, { patch: true })

		return {
			...res,
			parentSharedArtifact: artifact,
		}
	},
	async deleteImage(ctx) {
                const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
                const fileIds = artifact.images.map(f => f.id)
                const updated = await strapi.services['shared-artifact'].update({ id: artifact.id }, {
                        images: fileIds.filter(i => i.toString() !== ctx.params.imageId)
                })
                const file = await strapi.plugins.upload.services.upload.fetch({ id: ctx.params.imageId })

                return {
                        ...file,
                        parentSharedArtifact: updated,
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
                        ref: 'shared-artifact',
                        field: 'videos',
                }, files: {
                        name: file.name,
                        path: file.path,
			type: detectedType ? detectedType.mime : file.type,
                        size: file.size
                }})

		let artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
		let res = Array.isArray(outty) ? outty[0] : outty
		await strapi.plugins.upload.services.upload.updateFileInfo(res.id, { caption: artifact.nextCaption })
		res.caption = artifact.nextCaption

		const nextLetter = strapi.models.artifact.getNextLetter(artifact.nextCaption)
		artifact.nextCaption = nextLetter
		await strapi.query('shared-artifact').model.query(qb => (
		  qb.where('id', artifact.id)
		)).save({
		  updated_at: artifact.updated_at,
		  nextCaption: nextLetter,
		}, { patch: true })

		return {
			...res,
			parentSharedArtifact: artifact,
		}
	},
	async deleteVideo(ctx) {
                const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.artifactId })
                const fileIds = artifact.videos.map(f => f.id)
                const updated = await strapi.services['shared-artifact'].update({ id: artifact.id }, {
                        videos: fileIds.filter(i => i.toString() !== ctx.params.videoId)
                })
                const file = await strapi.plugins.upload.services.upload.fetch({ id: ctx.params.videoId })

                return {
                        ...file,
                        parentSharedArtifact: updated,
                }
	},
	async share(ctx) {
		const { sharedPortfolioId } = ctx.request.body
		const artifact = await strapi.services['shared-artifact'].findOne({ id: ctx.params.id })
		const sp = await strapi.services['shared-portfolio'].findOne({ id: sharedPortfolioId })

		let members = sp.members.map(user => user.id)
		if (ctx.state.user.role.type === 'researcher') {
			members.push(ctx.state.user.id)
		}
		if (!members.includes(ctx.state.user.id)) {
			return ctx.forbidden()
		}

		let params = {
			...artifact,
			sharedPortfolio: sp.id,
			structure: sp.structure,
			comments: [],
			reactions: [],
		}

		const entity = await strapi.services['shared-artifact'].create(params)
		return sanitizeEntity(entity, { model: strapi.models['shared-artifact'] })
	},
}
