const url = require('url')
const http = require('http')
const https = require('https')
const tls = require('tls')
const net = require('net')
const { Readable } = require('stream')
const waitFor = require('event-to-promise')

const proxyHandler = require('./lib/handler/proxy-handler')

const NetSocket = net.Socket

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

        const onConnect = buildOnConnect(net, tls)
        netSvr.on(`connect`, onConnect)
        tlsSvr.on(`connect`, onConnect)

        const onUpgrade = buildOnUpgrade(proxyHandler)
        netSvr.on(`upgrade`, onUpgrade)
        tlsSvr.on(`upgrade`, onUpgrade)

        const onRequest = buildOnRequest(proxyHandler)
        netSvr.on(`request`, onRequest)
        tlsSvr.on(`request`, onRequest)

        netSvr.on('listening', () => {
            console.log(`server listening: ${port}`)
        })

        tlsSvr.listen(443)
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

    function buildOnConnect(net, tls) {
        return async (req, socket, head) => {

            try {
                socket.write(`HTTP/1.1 200 OK\r\n\r\n`)

                if (!head || !head.length) {
                    head = await waitFor(socket, `data`)
                }
                
                let defaultPort = 80
                let protocol = `http://`
                let proxySender = net
                if (
                    head[0] === 0x16 ||
                    head[0] === 0x80 ||
                    head[0] === 0x00
                ) {
                    protocol = `https://`
                    proxySender = net
                    defaultPort = 443
                }

                const { hostname, port } = url.parse(`${protocol}${req.url}`)
                const proxySocket = proxySender.connect({
                    hostname: hostname,
                    port: port || defaultPort,
                    rejectUnauthorized: false,
                })

                socket.once(`error`, () => proxySocket.destroy())
                proxySocket.once(`error`, () => socket.destroy())

                socket.pause()

                await waitFor(proxySocket, `connect`)

                socket.resume()

                proxySocket.write(head)
                proxySocket.pipe(socket)
                socket.pipe(proxySocket)

            } catch (err) {
                socket.destroy()
            }
        }
    }

    function buildOnUpgrade(proxyHandler) {
        return async (req, socket, head) => {

            try {

                const proxyReq = proxyHandler.buildProxyReq(req)

                // 统一通过 NetSocket 开启远端的 tcp/(tls?) 链接
                const remoteSocket = new NetSocket()

                remoteSocket.connect(proxyReq.port, proxyReq.hostname, {
                    rejectUnauthorized: false,
                })

                socket.once(`error`, () => remoteSocket.destroy())
                remoteSocket.once(`error`, () => socket.destroy())

                remoteSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`)
                const len = req.rawHeaders.length
                for (let idx = 0; idx < len; idx+=2) {
                    remoteSocket.write(`${req.rawHeaders[idx]}: ${req.rawHeaders[idx + 1]}\r\n`)
                }
                remoteSocket.write(`\r\n`)
                remoteSocket.write(head)
                
                // 实现两个 stream 互相 write data
                remoteSocket.pipe(socket)
                socket.pipe(remoteSocket)

            } catch (err) {
                console.error(err)
                socket.destroy()
            }
        }
    }

    function buildOnRequest(proxyHandler) {
        return async (rawReq, rawRes) => {
            try {

                const proxyReq = proxyHandler.buildProxyReq(rawReq)
                const proxyRes = await proxyHandler.dispatchProxyReq(proxyReq)

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

    return {
        startListen,
        stopListen,
    }
}
