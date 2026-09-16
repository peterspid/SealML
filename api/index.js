// Vercel's documented Express entrypoint. `npm run build` compiles the API first.
module.exports = require("../dist/backend/src/app.js").app;
