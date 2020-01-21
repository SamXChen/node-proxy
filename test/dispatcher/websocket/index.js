const WebSocket = require('ws')
const tls = require('tls')

const {
    RootCa,
    HttpPort,
    HttpsPort,
} = require('../../consts')

const getWsClient = buildGetWsClient()

function buildGetWsClient() {

    const wsClients = {}

    const ProxyHost = `localhost`
    const ProxyPort = `8123`
    const SecureProxyPort = `443`

    const secureContext = tls.createSecureContext({
        ca: RootCa.cert,
    })

    function buildCtx(url, useProxy = false) {

        
        let ctx = {}
        
        if (/^wss:/.test(url)) {
            ctx.secureContext = secureContext
        } else {
            // do nothing
        }
        if (useProxy) {

            // proxy agent here will broke https.request, so load lazy
            const ProxyAgent = require('proxy-agent')
            if (ctx.secureContext) {
                // secure agent
                ctx.agent = new ProxyAgent(`http://${ProxyHost}:${ProxyPort}`)
            } else {
                // normal agent
                ctx.agent = new ProxyAgent(`http://${ProxyHost}:${ProxyPort}`)
            }
        }

        ctx.key = `${useProxy}::${url}`

        return ctx
    }

    return function getWsClient(url, useProxy) {

        const ctx = buildCtx(url, useProxy)
        const key = ctx.key

        if (wsClients[key]) {
            return wsClients[key]
        } else {
            return new Promise((resolve, reject) => {

                const wsClient = new WebSocket(url, {
                    ...ctx,
                })
                wsClient.on('open', () => {
                    if (wsClients[key] && wsClients[key] !== wsClient) {
                        try {
                            const preDeleteWsClient = wsClients[key]
                            delete wsClients[key]
                            preDeleteWsClient.close()
                        } catch(err) {
                            console.warn(err)
                        }
                    }
                    wsClients[key] = wsClient
                    resolve(wsClient)
                })
                wsClient.on('close', () => {
                    if (wsClients[key] === wsClient) {
                        delete wsClients[key]
                    }
                })
                wsClient.on('error', err => {
                    if (wsClients[key] === wsClient) {
                        delete wsClients[key]
                    }
                    console.error(err)
                    reject(err)
                })
            })
        }
    }
}

async function wsSend(path, data = {}, useProxy = false) {
    const url = `ws://localhost:${HttpPort}${path}`
    const ws = await getWsClient(url, useProxy)
    await ws.send(JSON.stringify(data))
    return ws
}

async function wssSend(path, data = {}, useProxy = false) {
    const url = `wss://localhost:${HttpsPort}${path}`
    const ws = await getWsClient(url, useProxy)
    await ws.send(JSON.stringify(data))
    return ws
}

module.exports = {
    wsSend,
    wssSend,
}