const { pki, md } = require('node-forge')
const { randomBytes } = require('crypto')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')

const CERT_DIR_PATH = path.resolve(__dirname, '../../ssl')
const ROOT_CERT_NAME = 'cert.pem'
const ROOT_KEY_NAME = 'key.pem'

const ROOT_CERT_PATH = path.join(CERT_DIR_PATH, ROOT_CERT_NAME)
const ROOT_KEY_PATH = path.join(CERT_DIR_PATH, ROOT_KEY_NAME)

const CAAttrs = [
	{
		name: 'commonName',
		value: 'NodeMockerProxyCA'
	},
	{
		name: 'countryName',
		value: 'Internet'
	},
	{
		shortName: 'ST',
		value: 'Internet'
	},
	{
		name: 'localityName',
		value: 'Internet'
	},
	{
		name: 'organizationName',
		value: 'Node Mocker Proxy CA'
	},
	{
		shortName: 'OU',
		value: 'CA'
	}
]

const CAExtensions = [
	{
		name: 'basicConstraints',
		cA: true
	},
	{
		name: 'keyUsage',
		keyCertSign: true,
		digitalSignature: true,
		nonRepudiation: true,
		keyEncipherment: true,
		dataEncipherment: true
	},
	{
		name: 'extKeyUsage',
		serverAuth: true,
		clientAuth: true,
		codeSigning: true,
		emailProtection: true,
		timeStamping: true
	},
	{
		name: 'nsCertType',
		client: true,
		server: true,
		email: true,
		objsign: true,
		sslCA: true,
		emailCA: true,
		objCA: true
	},
	{
		name: 'subjectKeyIdentifier'
	}
]

const ServerAttrs = [
	{
		name: 'countryName',
		value: 'Internet'
	},
	{
		shortName: 'ST',
		value: 'Internet'
	},
	{
		name: 'localityName',
		value: 'Internet'
	},
	{
		name: 'organizationName',
		value: 'Node Mocker Proxy CA'
	},
	{
		shortName: 'OU',
		value: 'Node Mocker Proxy Server Certificate'
	}
]

const ServerExtensions = [
	{
		name: 'basicConstraints',
		cA: false
	},
	{
		name: 'keyUsage',
		keyCertSign: false,
		digitalSignature: true,
		nonRepudiation: false,
		keyEncipherment: true,
		dataEncipherment: true
	},
	{
		name: 'extKeyUsage',
		serverAuth: true,
		clientAuth: true,
		codeSigning: false,
		emailProtection: false,
		timeStamping: false
	},
	{
		name: 'nsCertType',
		client: true,
		server: true,
		email: false,
		objsign: false,
		sslCA: false,
		emailCA: false,
		objCA: false
	},
	{
		name: 'subjectKeyIdentifier'
	}
]

const ExpireYears = 2
const KeyLen = 2048

module.exports.ensureRootCert = function() {
    let ca
    if (fs.existsSync(ROOT_KEY_PATH) && fs.existsSync(ROOT_CERT_PATH)) {
        ca = {
            cert: fs.readFileSync(ROOT_CERT_PATH, 'utf-8'),
            key: fs.readFileSync(ROOT_KEY_PATH, 'utf-8'),
        }
    } else {
        ca = generateRootCAKey()
        try {
            mkdirp.sync(CERT_DIR_PATH)
            fs.writeFileSync(ROOT_CERT_PATH, ca.cert, {
                mode: 0o600,
            })
            fs.writeFileSync(ROOT_KEY_PATH, ca.key, {
                mode: 0o600,
            })

        } catch(err) {
            console.warn(err)
        }
    }
    return ca
}

module.exports.ensureHostCert = function(ca, hosts) {
    return generateHostKey(ca, hosts)
}

function generateRootCAKey() {
    return generateCertificate({
        keyLen: KeyLen,
        expires: ExpireYears,
        subject: CAAttrs,
        issuer: CAAttrs,
        extensions: CAExtensions,
    })
}

function generateHostKey(ca, hosts) {
    return generateCertificate({
        keyLen: KeyLen,
        expires: ExpireYears,
        subject: [{
            name: 'commonName',
            value: hosts[0],
        }].concat(ServerAttrs),
        issuer: pki.certificateFromPem(ca.cert).issuer.attributes,
        extensions: ServerExtensions.concat([{
            name: 'subjectAltName',
            altNames: hosts.map(host => ({
                type: 2,
                value: host
            })),
        }]),
        privateKey: pki.privateKeyFromPem(ca.key),
    })
}

function generateCertificate({ 
    keyLen, 
    expires, 
    subject,
    issuer,
    extensions,
    privateKey,
}) {
    const keys = pki.rsa.generateKeyPair(keyLen)
    const cert = pki.createCertificate()

    cert.publicKey = keys.publicKey
    cert.serialNumber = randomSerialNumber()

    const ts = new Date()
    cert.validity.notBefore = new Date(ts)
    cert.validity.notAfter = new Date(ts.setFullYear(ts.getFullYear() + expires))

    cert.setSubject(subject)
    cert.setIssuer(issuer)
    cert.setExtensions(extensions)

    if (privateKey === undefined) {
        privateKey = keys.privateKey
    }
    cert.sign(
        privateKey,
        md.sha256.create()
    )

    return {
        cert: pki.certificateToPem(cert),
        key: pki.privateKeyToPem(keys.privateKey),
    }
}

function randomSerialNumber() {
    return randomBytes(16).toString('hex')
}
