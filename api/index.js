const postgrest = require("postgrest")
const getPort = require("get-port")
const micro = require("micro")
const { URL } = require("url")
const fetch = require("node-fetch")
const delay = require("delay")

let postgrestPort, postgrestUrl
getPort().then(async (serverPort) => {
  postgrestPort = serverPort
  await postgrest.startServer({
    dbUri: "postgres://postgres@localhost:5432/postgres",
    dbAnonRole: "postgres",
    dbSchema: "public",
    serverPort,
    dbPool: 2,
  })
  postgrestUrl = `http://localhost:${postgrestPort}`
})

module.exports = async (req, res) => {
  let delays = 0
  while (!postgrestUrl) {
    delays++
    if (delays > 20) {
      return micro.send(res, 500)
    }
    await delay(100)
  }

  const proxyTo = `${postgrestUrl}${req.url.replace(/^\/api/, "")}`
  console.log("proxying to", proxyTo)

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
  req.on("abort", () => {
    proxyRes.body.destroy()
  })
}
