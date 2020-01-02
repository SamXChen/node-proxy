const rq = require('request-promise')

const { 
    HttpPort, 
    HttpsPort, 
    RootCa,
} = require('../../consts')

const HttpBaseUrl = `http://localhost:${HttpPort}`
const HttpsBaseUrl  = `https://localhost:${HttpsPort}`

// set up agent ca for ssl
const commonOpts = {
    agentOptions: {
        ca: RootCa.cert,
    }
}

const DefaultProxyOpts = {
    proxy: 'http://localhost:8123',
}

async function get(url, data = {}, useProxy = false) {
    let proxyOpt = {}
    if (useProxy) {
        proxyOpt = DefaultProxyOpts
    }
    return await rq.get(url, {
        ...commonOpts,
        ...proxyOpt,
        qs: data,
    })
}

async function post(url, data = {}, useProxy = false) {
    let proxyOpt = {}
    if (useProxy) {
        proxyOpt = DefaultProxyOpts
    }
    return await rq.post(url, {
        ...commonOpts,
        ...proxyOpt,
        body: JSON.stringify(data),
    })
}

async function httpGet(path, data = {}, useProxy = false) {
    return await get(`${HttpBaseUrl}${path}`, data, useProxy)
}

async function httpPost(path, data, useProxy = false) {
    return await post(`${HttpBaseUrl}${path}`, data, useProxy)
}

async function httpsGet(path, data = {}, useProxy = false) {
    return await get(`${HttpsBaseUrl}${path}`, data, useProxy)
}

async function httpsPost(path, data, useProxy = false) {
    return await post(`${HttpsBaseUrl}${path}`, data, useProxy)
}

module.exports = {
    httpGet,
    httpPost,
    httpsGet,
    httpsPost,
}