const path = require('path')
const {
    SrcPath,
} = require('./consts')

// proxy server
const { start, dispose } = require(path.join(SrcPath, 'index.js'))

// testing server
const { startServer, disposeServer } = require('./server')

const {
    httpGet,
    httpPost,
    httpsGet,
    httpsPost,
} = require('./dispatcher/http')

const {
    wsSend,
    wssSend,
} = require('./dispatcher/websocket')

const DisposeTimeout = 2000
const DefaultPath = '/'

describe('service testing', () => {

    beforeAll(async () => {
        await startServer()
    })

    afterAll(() => {
        disposeServer()
    }, DisposeTimeout)

    const reqData = {
        text: 'test str',
    }

    describe('test service testing', () => {

        test('http request should be handled', async () => {
            let res
            res = await httpGet(DefaultPath, reqData)
            expect(JSON.parse(res)).toEqual(reqData)
            
            res = await httpPost(DefaultPath, reqData)
            expect(JSON.parse(res)).toEqual(reqData)
        })

        test('https request should be handled', async () => {
            let res
            res = await httpsGet(DefaultPath, reqData)
            expect(JSON.parse(res)).toEqual(reqData)

            res = await httpsPost(DefaultPath, reqData)
            expect(JSON.parse(res)).toEqual(reqData)
        })

        test('ws message should be handled', async () => {
            const ws = await wsSend(DefaultPath, reqData)
            return new Promise(resolve => {
                ws.on('message', msg => {
                    expect(msg).toEqual(JSON.stringify(reqData))
                    resolve()
                })
            })
        })

        test('wss message should be handled', async () => {
            const ws = await wssSend(DefaultPath, reqData)
            return new Promise(resolve => {
                ws.on('message', msg => {
                    expect(msg).toEqual(JSON.stringify(reqData))
                    resolve()
                })
            })
        })
    })

    describe('proxy service testing', () => {
        
        beforeAll(async () => {
            await start()
        })

        afterAll(() => {
            dispose()
        }, DisposeTimeout)

        const UseProxy = true

        test('http request should be correctly proxied', async () => {
            let res
            res = await httpGet(DefaultPath, reqData, UseProxy)
            expect(JSON.parse(res)).toEqual(reqData)

            res = await httpPost(DefaultPath, reqData, UseProxy)
            expect(JSON.parse(res)).toEqual(reqData)
        })

        test('https request should be correctly proxied', async () => {
            let res
            res = await httpsGet(DefaultPath, reqData, UseProxy)
            expect(JSON.parse(res)).toEqual(reqData)

            res = await httpsPost(DefaultPath, reqData, UseProxy)
            expect(JSON.parse(res)).toEqual(reqData)
        })

        test('ws message should be correctly proxied', async () => {

        })

        test('wss message should be correctly proxied', async () => {

        })
    })

    test('noop', () => {})
})
