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
    if (ctx.query._q) {
      entities = await strapi.services['shared-portfolio'].search(ctx.query)
    } else {
      entities = await strapi.services['shared-portfolio'].find(ctx.query)
    }

    let sanitized = entities.map(entity => sanitizeEntity(entity, { model: strapi.models['shared-portfolio'] }))
	if (ctx.state.user.role.type !== 'researcher') {
		sanitized = sanitized.filter(p => p.members.map(m => m.id).includes(ctx.state.user.id))
	}
	const portfolioIds = sanitized.map(p => p.id)
	  const artifacts = await strapi.services['shared-artifact'].find({ sharedPortfolio_in: portfolioIds })
	  const artifactIds = artifacts.map(a => a.id)

    let commentCounts = {}
    const comments = await strapi.services.comment.find({ sharedArtifact_in: artifactIds })
    comments.forEach((comment) => {
      const artifact = artifacts.find(a => a.id === comment.sharedArtifact.id)
      commentCounts[artifact.sharedPortfolio.id] = (commentCounts[artifact.sharedPortfolio.id] || 0) + 1
    })

    const reactions = await strapi.services.reaction.find({ sharedArtifact_in: artifactIds })
    reactions.forEach((reaction) => {
      const artifact = artifacts.find(a => a.id === reaction.sharedArtifact.id)
      commentCounts[artifact.sharedPortfolio.id] = (commentCounts[artifact.sharedPortfolio.id] || 0) + 1
    })

	  return sanitized.map(p => ({
		  ...p,
		  commentCount: commentCounts[p.id] || 0
	  }))
  },
  async exportAll(ctx) {
    const sharedPortfolios = await strapi.services['shared-portfolio'].find()
    const sharedArtifacts = await strapi.services['shared-artifact'].find()
    const users = await strapi.plugins['users-permissions'].services.user.fetchAll()

    let rows = [[
      'Shared Portfolio',
      'Owner',
      'Teachers Who Submitted Artifacts',
      'Artifacts',
      'Artifacts with Bonus Questions Answered',
      'Artifacts with Documents',
      'Artifacts with Images',
      'Artifacts with Videos',
      'Documents',
      'Images',
      'Videos',
      'Teachers Who Commented or Reacted',
      'Comments',
      'Reactions',
      'Tag Reactions',
      'Star Reactions',
      'Bridge Reactions',
      'Question Reactions',
    ]]
    let sharedArtifactsMap = {}
    let usersMap = {}

    sharedArtifacts.forEach((sharedArtifact) => {
      sharedArtifactsMap[sharedArtifact.id] = sharedArtifact
    })

    users.forEach((user) => {
      usersMap[user.id] = user
    })

    sharedPortfolios.forEach((sharedPortfolio) => {
      let teachersSubmitted = {}
      let bonusAnswered = 0
      let withDocuments = 0
      let withImages = 0
      let withVideos = 0
      let totalDocuments = 0
      let totalImages = 0
      let totalVideos = 0
      let teachersCommentedReacted = {}
      let totalComments = 0
      let totalReactions = 0
      let reactions = { '🔖': 0, '⭐': 0, '🌉': 0, '❓': 0 }

      const artifacts = sharedPortfolio.sharedArtifacts.map(sharedArtifact => (
        sharedArtifactsMap[sharedArtifact.id]
      )).filter(sharedArtifact => sharedArtifact)

      artifacts.forEach((artifact) => {
        teachersSubmitted[artifact.owner.email] = true

        if (strapi.models['shared-artifact'].isBonusComplete(artifact)) {
          ++bonusAnswered
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

        artifact.comments.forEach((comment) => {
          const user = usersMap[comment.owner]

          if (user) {
            teachersCommentedReacted[user.email] = true
            ++totalComments
          }
        })

        artifact.reactions.forEach((reaction) => {
          const user = usersMap[reaction.owner]

          if (user && reactions.hasOwnProperty(reaction.value)) {
            teachersCommentedReacted[user.email] = true
            ++totalReactions
            ++reactions[reaction.value]
          }
        })
      })

      rows.push([
        sharedPortfolio.name,
        sharedPortfolio.owner.email,
        Object.keys(teachersSubmitted).sort().join(', '),
        artifacts.length,
        bonusAnswered,
        withDocuments,
        withImages,
        withVideos,
        totalDocuments,
        totalImages,
        totalVideos,
        Object.keys(teachersCommentedReacted).sort().join(', '),
        totalComments,
        totalReactions,
        reactions['🔖'],
        reactions['⭐'],
        reactions['🌉'],
        reactions['❓'],
      ])
    })

    ctx.type = 'text/csv; charset=utf-8'
    ctx.attachment('shared portfolios.csv')
    ctx.body = stringify(rows)
  },
  async findOne(ctx) {
    const { id } = ctx.params

    const entity = await strapi.services['shared-portfolio'].findOne({ id })
    let sanitized = sanitizeEntity(entity, { model: strapi.models['shared-portfolio'] })
	  const ownerIds = sanitized.sharedArtifacts.map(artifact => artifact.owner)
	  const users = await strapi.plugins['users-permissions'].services.user.fetchAll({ id_in: ownerIds })
	  let usernames = {}
	  users.forEach((u) => {
		  usernames[u.id] = u.username
	  })

    let commentCounts = {}
    let commentTexts = {}
    let reactionArtifacts = { '🔖': [], '⭐': [], '🌉': [], '❓': [] }

    const comments = await strapi.services.comment.find({ sharedArtifact_in: sanitized.sharedArtifacts.map(artifact => artifact.id) })
    comments.forEach((comment) => {
      const sharedArtifactId = comment.sharedArtifact.id
      commentCounts[sharedArtifactId] = (commentCounts[sharedArtifactId] || 0) + 1
      commentTexts[sharedArtifactId] = commentTexts[sharedArtifactId] || []
      commentTexts[sharedArtifactId].push(comment.text)
    })

    const reactions = await strapi.services.reaction.find({ sharedArtifact_in: sanitized.sharedArtifacts.map(artifact => artifact.id) })
    reactions.forEach((reaction) => {
      commentCounts[reaction.sharedArtifact.id] = (commentCounts[reaction.sharedArtifact.id] || 0) + 1
      reactionArtifacts[reaction.value].push(reaction.sharedArtifact.id)
    })

    sanitized.sharedArtifacts = sanitized.sharedArtifacts.map(artifact => ({
      ...artifact,
      commentCount: commentCounts[artifact.id] || 0,
      commentTexts: commentTexts[artifact.id] || [],
      ownerUsername: usernames[artifact.owner],
      reactions: {
        '🔖': reactionArtifacts['🔖'].includes(artifact.id),
        '⭐': reactionArtifacts['⭐'].includes(artifact.id),
        '🌉': reactionArtifacts['🌉'].includes(artifact.id),
        '❓': reactionArtifacts['❓'].includes(artifact.id),
      },
    }))

    return sanitized
  },
  async create(ctx) {
	  const template = await strapi.services.portfolio.findOne({ id: 1 })
    let params = {
	    ...ctx.request.body,
	    owner: ctx.state.user.id,
	    members: [ ctx.state.user.id ],
	    templateStructure: template.structure,
    }
    const entity = await strapi.services['shared-portfolio'].create(params)
    return sanitizeEntity(entity, { model: strapi.models['shared-portfolio'] })
  },
	async members(ctx) {
		const { id } = ctx.params
		const portfolio = await strapi.services['shared-portfolio'].findOne({ id })
		const users = await strapi.plugins['users-permissions'].services.user.fetchAll()
		const invites = await strapi.services.invitation.find({ sharedPortfolio: id })
		const memberIds = portfolio.members.map(u => u.id)

		let members = []
		let pending = []
		let nonMembers = []
		users.forEach((user) => {
			const invite = invites.find(i => i.to.id === user.id)
			const userData = {
				id: user.id,
				username: user.username,
				email: user.email,
			}
			if (memberIds.includes(user.id)) {
				if (ctx.state.user.id !== user.id) {
					members.push(userData)
				}
			}
			else if (invite) {
				pending.push({
					...userData,
					invitationId: invite.id,
				})
			}
			else {
				nonMembers.push(userData)
			}
		})

		return {
			members,
			pending,
			nonMembers,
		}
	},
	async removeUser(ctx) {
		const { id } = ctx.params
		const userId = parseInt(ctx.params.userId)
		const portfolio = await strapi.services['shared-portfolio'].findOne({ id })

		if (portfolio.owner.id !== ctx.state.user.id) {
			return ctx.badRequest('Only the shared portfolio owner may remove other users.')
		}

		if (userId === ctx.state.user.id) {
			return ctx.badRequest('You cannot remove yourself. Please use the "leave" endpoint and assign a new owner.')
		}

		const memberIds = portfolio.members.map(u => u.id)
		const newMemberIds = memberIds.filter(uid => uid !== userId)

		const entity = await strapi.services['shared-portfolio'].update({ id }, { members: newMemberIds })
		return sanitizeEntity(entity, { model: strapi.models['shared-portfolio'] })
	},
	async leave(ctx) {
		const { id } = ctx.params
		const { body } = ctx.request
		const portfolio = await strapi.services['shared-portfolio'].findOne({ id })
		const memberIds = portfolio.members.map(u => u.id)
		const newMemberIds = memberIds.filter(uid => uid !== ctx.state.user.id)

		if (portfolio.owner.id === ctx.state.user.id) {
			if (!body.newOwnerId) {
				return ctx.badRequest('You cannot leave this shared portfolio without assigning a new owner.')
			}
			const newOwner = await strapi.plugins['users-permissions'].services.user.fetch({ id: body.newOwnerId })
			if (!newOwner) {
				return ctx.badRequest('New owner with ID ' + body.newOwnerId + ' does not exist.')
			}
			if (!memberIds.includes(newOwner.id)) {
				return ctx.badRequest('New owner ' + newOwner.username + ' is not a member of this shared portfolio.')
			}
			await strapi.services['shared-portfolio'].update({ id }, { owner: newOwner.id, members: newMemberIds })
		}
		else {
			await strapi.services['shared-portfolio'].update({ id }, { members: newMemberIds })
		}
		const newb = await strapi.services['shared-portfolio'].findOne({ id })
		return sanitizeEntity(newb, { model: strapi.models['shared-portfolio'] })
	}
}
