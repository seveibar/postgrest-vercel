const postgrest = require("postgrest")
const getPort = require("get-port")
const micro = require("micro")
const { URL } = require("url")
const fetch = require("node-fetch")
const delay = require("delay")

let postgrestPort, postgrestUrl, server

async function startServer() {
  console.log("starting server...")
  postgrestPort = await getPort()
  server = await postgrest.startServer({
    dbUri:
      process.env.POSTGRES_URI ||
      process.env.POSTGRES_URL ||
      "postgresql://postgres@localhost:5432/postgres",
    dbAnonRole: "postgres",
    dbSchema: "public",
    serverPort: postgrestPort,
    dbPool: 2,
  })
  postgrestUrl = `http://localhost:${postgrestPort}`
}

async function startOrResetServer() {
  console.log("startOrResetServer", Boolean(server))
  if (!server) {
    console.log("server not yet initialized, initializing...")
    await startServer()
    console.log(postgrestUrl)
  } else {
    try {
      const res = await fetch(postgrestUrl)
      console.log("res", res)
      if (!(res.status >= 200 && res.status < 300)) {
        console.log("Couldn't connect to previous postgrest instance")
        throw new Error("Couldn't connect to previous postgrest instance")
      }
    } catch (e) {
      console.log(e.toString())
      console.log("RESTARTING SERVER")
      await server.stop()
      await startServer()
    }
  }
}

module.exports = async (req, res) => {
  await startOrResetServer()

  const proxyTo = `${postgrestUrl}${req.url.replace(/^\/api/, "")}`

  const proxyRes = await fetch(proxyTo, {
    method: req.method,
    headers: Object.assign(
      { "x-forwarded-host": req.headers.host },
      req.headers,
      { host: req.host }
    ),
    body: req.body,
    redirect: "manual",
  })

  res.statusCode = proxyRes.status
  proxyRes.body.pipe(res)
}
