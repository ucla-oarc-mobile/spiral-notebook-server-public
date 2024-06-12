const fs = require('fs')

module.exports = ({ env }) => ({
  email: {
    provider: 'sendmail',
    providerOptions: {
      dkim: {
        privateKey: fs.readFileSync('./dkim-private.pem', 'utf8'),
        keySelector: 'default',
      },
    },
    settings: {
      defaultFrom: 'no-reply@spiralproject.org',
    },
  },
})
