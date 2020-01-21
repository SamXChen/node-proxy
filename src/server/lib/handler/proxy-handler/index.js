const http = require('http')
const https = require('https')
const Url = require('url')

function buildProxyReq(rawReq) {

    const url = rawReq.url
    const urlInfo = Url.parse(url, true)
    const { host, hostname, port, protocol, path } = urlInfo

    let proxyReq = {
        url,
        port,
        host,
        hostname,
        method: rawReq.method,
        path,
        headers: {...rawReq.headers},
        secure: protocol === 'https:',
        rawReq,
        //todo
        handled: false,
    }
    return proxyReq
}

function dispatchProxyReq(proxyReq) {
    let sender
    if (proxyReq.secure) {
        sender = https
    } else {
        sender = http
    }

    const { rawReq, url, secure } = proxyReq
    return new Promise((resolve, reject) => {

        const opts = {
            ...proxyReq
        }

        if (secure) {
            opts.rejectUnauthorized = false
        }

        const realReq = sender.request(url, opts)

        // if unhandled by rules, pipe req directly
        if (proxyReq.handled !== true) {
            rawReq.pipe(realReq)
        }

        rawReq.on('aborted', () => {
            realReq.abort()
            reject()
        })

        realReq.on('error', err => {
            reject(err)
        })

        realReq.on('response', realRes => {
            resolve(realRes)
        })

    }).catch(err => { 
        console.error(err) 
        throw err 
    })
}

module.exports = {
    buildProxyReq,
    dispatchProxyReq,
}