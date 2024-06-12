module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('API_URL', 'http://localhost'),
  admin: {
    url: env('ADMIN_URL', 'http://localhost:1337/admin'),
    auth: {
      secret: env('ADMIN_JWT_SECRET', 'deadbeefdeadbeefdeadbeefdeadbeef'),
    },
  },
  rest: {
    defaultLimit: 1000,
    maxLimit: 1000,
  },
})
