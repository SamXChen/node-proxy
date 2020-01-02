const http = require('http')
const https = require('https')
const tls = require('tls')
const net = require('net')
const { Readable } = require('stream')
const waitFor = require('event-to-promise')

const proxyHandler = require('./lib/handler/proxy-handler')

const TLSSocket = tls.TLSSocket

module.exports.init = function() {

    const DefaultPort = 8123

    let netSvr
    let tlsSvr

    function startListen(opts = {}) {
        const { rootCa, port = DefaultPort, ensureHostCert } = opts

        netSvr = http.createServer()
        tlsSvr = https.createServer({
            cert: rootCa.cert,
            key: rootCa.key,
            SNICallback: buildSNICb(rootCa, ensureHostCert),
        })    

        netSvr.on(`clientError`, err => {
            console.error(err)
        })
        tlsSvr.on(`tlsClientError`, err => {
            console.error(err)
        })

        const onConnect = buildOnConnect(netSvr, tlsSvr)
        netSvr.on(`onConnect`, onConnect)

        const onUpgrade = buildOnUpgrade()
        netSvr.on(`upgrade`, onUpgrade)
        tlsSvr.on(`upgrade`, onUpgrade)

        const onRequest = buildOnRequest(proxyHandler)
        netSvr.on(`request`, onRequest)
        tlsSvr.on(`request`, onRequest)

        netSvr.on('listening', () => {
            console.log(`server listening: ${port}`)
        })

        tlsSvr.listen()
        netSvr.listen(port)
    }

    function stopListen() {
        if (netSvr) {
            netSvr.close()
            netSvr = undefined
        }
        if (tlsSvr) {
            tlsSvr.close()
            tlsSvr = undefined
        }
    }

    function buildSNICb(rootCa, ensureHostCert) {

        const hostKeys = {}

        return (servername, cb) => {
            try {
                if (hostKeys[servername] === undefined) {
                    hostKeys[servername] = tls.createSecureContext(
                        ensureHostCert(rootCa, [servername])
                    )
                }
                return cb(null, hostKeys[servername])
            } catch(err) {
                return cb(err)
            }
        }
    }

    function buildOnConnect(netSvr, tlsSvr) {
        return async (req, socket, head) => {

            try {
                socket.write(`HTTP/1.1 200 OK\r\n\r\n`)

                if (!head || !head.length) {
                    head = await waitFor(socket, `data`)
                }

                let proxySvr = netSvr
                if (
                    head[0] === 0x16 ||
                    head[0] === 0x80 ||
                    head[0] === 0x00
                ) {
                    proxySvr = tlsSvr
                }

                const proxySocket = net.connect(proxySvr.address().port)

                socket.once('error', () => proxySocket.destroy())
                proxySocket.once('error', () => socket.destroy())

                socket.pause()

                await waitFor(proxySocket, `connect`)

                socket.resume()

                proxySocket.pipe(socket)
                proxySocket.write(head)
                socket.pipe(proxySocket)

            } catch (err) {
                socket.destroy()
            }
        }
    }

    function buildOnUpgrade(requestHandler, upStreamMgr) {
        return async (rawReq, socket, head) => {

            try {

                const req = new UpgradeRequest(upStreamMgr, rawReq, socket, head)

                await requestHandler.handleRequest(req)

                if (!req.accepted) {
                    let remoteSocket = await upStreamMgr.connect(
                        req.port,
                        req.hostname,
                        req.href,
                        req.headers[`user-agent`],
                    )
                    if (req.secure) {
                        remoteSocket = new TLSSocket(remoteSocket)
                    }

                    socket.once(`error`, () => remoteSocket.destroy())
                    remoteSocket.once(`error`, () => socket.destroy())

                    remoteSocket.pipe(socket)

                    remoteSocket.write(`${rawReq.method} ${rawReq.url} HTTP/${rawReq.httpVersion}\r\n`)
                    const len = rawReq.rawHeaders.length
                    for (let idx = 0; idx < len; ++idx) {
                        remoteSocket.write(`${rawReq.rawHeaders[idx]}: ${rawReq.rawHeaders[idx + 1]}\r\n`)
                    }
                    remoteSocket.write(`\r\n`)
                    remoteSocket.write(head)

                    socket.pipe(remoteSocket)
                }

            } catch (error) {
                socket.destroy()
            }
        }
    }

    function buildOnRequest(proxyHandler) {
        return async (rawReq, rawRes) => {
            try {

                // clone req
                // edit req
                // if has res, get res
                // if has no res, dispatch req, get res
                // finally pipe res

                const proxyReq = proxyHandler.buildReq(rawReq)
                const proxyRes = await proxyHandler.dispatch(proxyReq)

                const statusCode = proxyRes.statusCode || proxyRes.status || 200

                rawRes.writeHead(statusCode, proxyRes.headers)

                let stream = null
                if (typeof proxyRes.stream === 'function') {
                    stream = proxyRes.stream()
                } else if (proxyRes.body instanceof Readable) {
                    stream = proxyRes.body
                } else if (proxyRes instanceof Readable) {
                    stream = proxyRes
                }

                if (!stream) {
                    rawRes.end(proxyRes.body)
                } else if (!stream.readable) {
                    rawRes.end()
                } else {
                    stream.pipe(rawRes)
                    await waitFor(stream, 'end')
                }

            } catch (error) {
                if (rawRes.writable) {
                    rawRes.writeHead(500)
                    rawRes.end()
                }
            }
        }
    }

    function getURL(req) {
        const parsedURL = url.parse(req.url)
        return url.format({
            protocol: req.socket.encrypted ? `https:` : `http:`,
            host: req.headers.host,
            pathname: parsedURL.pathname,
            search: parsedURL.search,
        })
    }

    return {
        startListen,
        stopListen,
    }
}
