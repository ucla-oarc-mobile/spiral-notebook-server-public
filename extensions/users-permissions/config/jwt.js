module.exports = {
  jwt: {
    expiresIn: '90d',
  },
  jwtSecret: process.env.JWT_SECRET || '0870a1a0-c6ad-44db-abae-cf49017de3e0',
}
