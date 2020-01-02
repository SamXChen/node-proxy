const url = require('url')

function json(data) {
    this.writeHead(200, {
        'Content-Type': 'application/json',
    })
    this.end(JSON.stringify(data))
}

module.exports.defaultHttpHandler = function(req, res) {
    
    if (req.method === 'GET') {
        const qs = url.parse(req.url, true).query
        return json.call(res, qs)
    }
    if (req.method === 'POST') {
        let body = []
        req.on('data', chunk => {
            body.push(chunk)
        }).on('end', () => {
            body = Buffer.concat(body).toString();
    
            const bodyData = JSON.parse(body)
            return json.call(res, bodyData)
        })
    }

}