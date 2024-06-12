'use strict'

const fetch = require('node-fetch')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
	async refresh(ctx) {
		return {
			jwt: strapi.plugins['users-permissions'].services.jwt.issue({
				id: ctx.state.user.id,
			}, [-1, -6, -42].includes(ctx.state.user.id) ? { expiresIn: '3m' } : undefined)
		}
	},
}
