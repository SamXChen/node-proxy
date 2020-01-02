const path = require('path')
const fs = require('fs')

const Host = '127.0.0.1'
const HttpPort = 1337
const HttpsPort = 1338

const RootPath = path.resolve(__dirname, '../..')
const SrcPath = path.join(RootPath, 'src')
const SSLPath = path.join(__dirname, './ssl')

const RootCa = {
    key: fs.readFileSync(path.join(SSLPath, 'key.pem')),
    cert: fs.readFileSync(path.join(SSLPath, 'cert.pem')),
}

module.exports = {
    RootPath,
    SrcPath,
    HttpPort,
    HttpsPort,
    SSLPath,
    Host,
    RootCa,
}
