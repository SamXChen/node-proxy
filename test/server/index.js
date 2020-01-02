const http = require('http')
const https = require('https')
const path = require('path')
const tls = require('tls')
const waitFor = require('event-to-promise')
const WebSocket = require('ws')

const { 
    SrcPath,
    HttpPort,
    HttpsPort,
    RootCa,
} = require('../consts')

const {
    defaultHttpHandler,
} = require('./controllers/http')

const { ensureHostCert } = require(path.join(SrcPath, '/keygen'))

let httpSvr
let httpsSvr
let wsSvr
let wssSvr

function createHttpServer() {
    let httpSvr
    return new Promise((resolve, reject) => {
        httpSvr = http.createServer((req, res) => {
            defaultHttpHandler(req, res)
        })
        httpSvr.listen(HttpPort, e => {
            if (e) {
                reject(e)
            } else {
                resolve(httpSvr)
            }
        })
    })
}

function createHttpsServer() {
    let httpsSvr
    const options = {
        key: RootCa.key,
        cert: RootCa.cert,
        SNICallback: buildSNICb(RootCa, ensureHostCert),
    }

    return new Promise((resolve, reject) => {
        httpsSvr = https.createServer(options, (req, res) => {
            defaultHttpHandler(req, res)
        })
        httpsSvr.listen(HttpsPort, e => {
            if (e) {
                reject(e)
            } else {
                resolve(httpsSvr)
            }
        })
    })
}

function createWebSocketServer(httpSvr) {
    let svr
    svr = new WebSocket.Server({
        server: httpSvr,
    })
    svr.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg)
        })
    })
    return svr
}

function buildSNICb(RootCa, ensureHostCert) {
    const hostKeys = {}

    return (servername, cb) => {
        try {
            if (hostKeys[servername] === undefined) {
                hostKeys[servername] = tls.createSecureContext(
                    ensureHostCert(RootCa, [servername])
                )
            }
            return cb(null, hostKeys[servername])
        } catch(err) {
            return cb(err)
        }
    }
}

async function startServer() {
    await disposeServer()
    httpSvr = await createHttpServer()
    httpsSvr = await createHttpsServer()
    wsSvr = createWebSocketServer(httpSvr)
    wssSvr = createWebSocketServer(httpsSvr)
}

async function disposeServer() {
    if (wsSvr) {
        wsSvr.clients.forEach(client => {
            client.terminate()
        })
        wsSvr = undefined
    }
    if (wssSvr) {
        wssSvr.clients.forEach(client => {
            client.terminate()
        })
        wssSvr = undefined
    }
    if (httpSvr && httpSvr.close) {
        httpSvr.close()
        await waitFor(httpSvr, 'close')
        httpSvr = undefined
    }
    if (httpsSvr && httpsSvr.close) {
        httpsSvr.close()
        await waitFor(httpsSvr, 'close')
        httpsSvr = undefined
    }
}

module.exports = {
    startServer,
    disposeServer,
}