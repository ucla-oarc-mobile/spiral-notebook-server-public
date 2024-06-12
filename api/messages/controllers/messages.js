'use strict'

const fetch = require('node-fetch')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
	async list(ctx) {
		return []
	},
	async registerToken(ctx) {
		return {}
	},
	async unregisterToken(ctx) {
		return {}
	},
	async markAsRead(ctx) {
		return {}
	},
}
