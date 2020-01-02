const WebSocket = require('ws')
const tls = require('tls')

const {
    RootCa,
} = require('../../consts')

const {
    HttpPort,
    HttpsPort,
} = require('../../consts')

const getWsClient = buildGetWsClient()

function buildGetWsClient() {

    const wsClients = {}

    const secureContext = tls.createSecureContext({
        ca: RootCa.cert,
    })

    return function getWsClient(url) {
        if (wsClients[url]) {
            return wsClients[url]
        } else {
            return new Promise(resolve => {
                const wsClient = new WebSocket(url, {
                    secureContext,
                })
                wsClient.on('open', () => {
                    if (wsClients[url] && wsClients[url] !== wsClient) {
                        try {
                            const preDeleteWsClient = wsClients[url]
                            delete wsClients[url]
                            preDeleteWsClient.close()
                        } catch(err) {
                            console.warn(err)
                        }
                    }
                    wsClients[url] = wsClient
                    resolve(wsClient)
                })
                wsClient.on('close', () => {
                    if (wsClients[url] === wsClient) {
                        delete wsClients[url]
                    }
                })
            })
        }
    }
}

async function wsSend(path, data = {}) {
    const url = `ws://localhost:${HttpPort}${path}`
    const ws = await getWsClient(url)
    await ws.send(JSON.stringify(data))
    return ws
}

async function wssSend(path, data = {}) {
    const url = `wss://localhost:${HttpsPort}${path}`
    const ws = await getWsClient(url)
    await ws.send(JSON.stringify(data))
    return ws
}

module.exports = {
    wsSend,
    wssSend,
}