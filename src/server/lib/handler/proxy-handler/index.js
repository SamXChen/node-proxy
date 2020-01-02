const http = require('http')
const https = require('https')

function buildProxyReq(rawReq) {
    let proxyReq = {
        // todo
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

    const url = proxyReq.url
    return new Promise(resolve => {
        sender.request(url, {
            ...proxyReq,
        }, res => {
            resolve(res)
        })
    })
}

module.exports = {
    buildProxyReq,
    dispatchProxyReq,
}