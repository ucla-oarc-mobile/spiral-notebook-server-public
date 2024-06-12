'use strict'

const { sanitizeEntity, getAbsoluteAdminUrl } = require('strapi-utils')
const crypto = require('crypto')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    let entities = await strapi.services.invitation.find({ to: ctx.state.user.id })
	  return entities.map(entity => sanitizeEntity(entity, { model: strapi.models.invitation }))
  },
	async create(ctx) {
		let { to, email, sharedPortfolio } = ctx.request.body
		let settings
		let existingUser
		let toEmail
		const sp = await strapi.services['shared-portfolio'].findOne({ id: sharedPortfolio })
		const spName = sp.name
		const adminUrl = getAbsoluteAdminUrl(strapi.config)
		const server = adminUrl.includes('staging') ? 'staging.spiralproject.org' : 'spiralproject.org'

		if (email) {
			existingUser = await strapi.plugins['users-permissions'].services.user.fetch({ email })
			if (existingUser) {
				to = existingUser.id
				toEmail = email
			}
			else {
				const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
				if (!emailRegExp.test(email)) {
					return ctx.badRequest('Invalid email address.')
				}
				email = email.toLowerCase()
				const resetPasswordToken = crypto.randomBytes(64).toString('hex')
				const newUser = await strapi.plugins['users-permissions'].services.user.add({
					provider: 'local',
					email,
					password: email,
					username: email.replace(/@.*/, ''),
					confirmed: true,
					blocked: false,
					role: 1,
					resetPasswordToken,
				})

				const template = await strapi.services.portfolio.findOne({ id: 1 })
				const firstPortfolio = await strapi.services.portfolio.create({
					owner: newUser.id,
					structure: template.structure,
					name: 'My Portfolio 1',
					grades: [],
				})

				const pluginStore = await strapi.store({
					environment: '',
					type: 'plugin',
					name: 'users-permissions',
				})
				settings = await pluginStore.get({ key: 'email' }).then(storeEmail => storeEmail['email_confirmation'].options)

				const advanced = await pluginStore.get({
					key: 'advanced',
				})
				const userInfo = sanitizeEntity(newUser, { model: strapi.query('user', 'users-permissions').model})

				settings.message = await strapi.plugins['users-permissions'].services.userspermissions.template(settings.message, {
					URL: advanced.email_reset_password,
					USER: userInfo,
					TOKEN: resetPasswordToken,
				})

				settings.object = await strapi.plugins['users-permissions'].services.userspermissions.template(settings.object, { USER: userInfo })

				to = newUser.id
				toEmail = email
			}
		}
		else {
			existingUser = await strapi.plugins['users-permissions'].services.user.fetch({ id: to })
			toEmail = existingUser.email
		}
		const params = {
			from: ctx.state.user.id,
			to,
			sharedPortfolio,
		}

		const entity = await strapi.services.invitation.create(params)

		if (!settings) {
			settings = {
				object: 'Invitation to join a shared portfolio',
				message: '<p>You have been invited to participate in sharedPortfolio at <a href="https://' + server + '">' + server + '</a>. Please log in and accept the invitation.</p>',
			}
		}

		await strapi.plugins['email'].services.email.send({
			to: toEmail,
			from: 'Spiral Notebook <no-reply@' + server + '>',
			subject: settings.object,
			text: settings.message.replace(/sharedPortfolio/g, spName),
			html: settings.message.replace(/sharedPortfolio/g, spName),
		})

		return sanitizeEntity(entity, { model: strapi.models.invitation })
	},
	async createOutside(ctx) {
		const adminUrl = getAbsoluteAdminUrl(strapi.config)
		const server = adminUrl.includes('staging') ? 'staging.spiralproject.org' : 'spiralproject.org'
		let { email, username, roleId } = ctx.request.body

			const existingUser = await strapi.plugins['users-permissions'].services.user.fetch({ email })
			if (existingUser) {
				return ctx.badRequest('User already exists.')
			}

				const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
				if (!emailRegExp.test(email)) {
					return ctx.badRequest('Invalid email address.')
				}
				email = email.toLowerCase()
				const resetPasswordToken = crypto.randomBytes(64).toString('hex')
				const newUser = await strapi.plugins['users-permissions'].services.user.add({
					provider: 'local',
					email,
					password: email,
					username: username || email.replace(/@.*/, ''),
					confirmed: true,
					blocked: false,
					role: roleId || 1,
					resetPasswordToken,
				})

				if (roleId !== 4) {
					const template = await strapi.services.portfolio.findOne({ id: 1 })
					const firstPortfolio = await strapi.services.portfolio.create({
						owner: newUser.id,
						structure: template.structure,
						name: 'My Portfolio 1',
						grades: [],
					})
				}

				const pluginStore = await strapi.store({
					environment: '',
					type: 'plugin',
					name: 'users-permissions',
				})
				const settings = await pluginStore.get({ key: 'email' }).then(storeEmail => storeEmail['email_confirmation'].options)

				const advanced = await pluginStore.get({
					key: 'advanced',
				})
				const userInfo = sanitizeEntity(newUser, { model: strapi.query('user', 'users-permissions').model})

				settings.message = await strapi.plugins['users-permissions'].services.userspermissions.template(settings.message, {
					URL: advanced.email_reset_password,
					USER: userInfo,
					TOKEN: resetPasswordToken,
				})

				settings.object = await strapi.plugins['users-permissions'].services.userspermissions.template(settings.object, { USER: userInfo })

		let msg = settings.message.replace(/You have been invited to participate in sharedPortfolio. /, '')
		msg = msg.replace(/ After you log in, please accept the invitation to sharedPortfolio./, '')

		await strapi.plugins['email'].services.email.send({
			to: email,
			from: 'Spiral Notebook <no-reply@' + server + '>',
			subject: settings.object,
			text: msg,
			html: msg,
		})

		return userInfo
	},
	async accept(ctx) {
		const invite = await strapi.services.invitation.findOne({ id: ctx.params.id })
		let portfolio = await strapi.services['shared-portfolio'].findOne({ id: invite.sharedPortfolio.id })
		const memberIds = portfolio.members.map(u => u.id)
		if (!memberIds.includes(invite.to.id)) {
			portfolio = await strapi.services['shared-portfolio'].update({ id: invite.sharedPortfolio.id }, { members: memberIds.concat(invite.to.id) })
		}
		await strapi.services.invitation.delete({ id: ctx.params.id })
		return sanitizeEntity(portfolio, { model: strapi.models['shared-portfolio'] })
	},
}
