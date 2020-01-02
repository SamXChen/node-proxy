const { startServer, disposeServer } = require('./server')

const { 
    httpGet, 
    httpPost,
    httpsGet,
    httpsPost,
} = require('./dispatcher/http')

const {
    wsSend,
} = require('./dispatcher/websocket')

async function start() {

    try {
        // start server
        await startServer()
    
        // start send http req to server
        await httpGet('/', {
            text: 'test',
        })
    
        await httpPost('/', {
            text: 'test',
        })
    
        await httpsGet('', {
            text: 'test',
        })
    
        await httpsPost('/', {
            text: 'test',
        })
        
        await wsSend('/ws', {
            text: 'test'
        })

    } catch (err) {
        console.warn(err)
    } finally {
        disposeServer()
    }

}

start()
