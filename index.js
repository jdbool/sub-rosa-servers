const dgram = require('dgram');
const { Parser } = require('binary-parser-encoder');

function nlo(byte) {
	return (byte) & 0xF;
}

function nhi(byte) {
	return ((byte) >> 4) & 0xF;
}

const masterServerParsers = {
	[2012]: new Parser()
		.string('header', { length: 5 })
		.uint32le('numServers')
		.array('servers', {
			type: new Parser()
				.array('address', {
					type: 'uint8',
					length: 4,
					formatter: arr => arr.reverse().join('.'),
					encoder: str => str.split('.').reverse()
				})
				.uint16le('port'),
			length: 'numServers'
		}),
	[2015]: new Parser()
		.string('header', { length: 5 })
		.uint32le('numServers')
		.array('servers', {
			type: new Parser()
				.array('address', {
					type: 'uint8',
					length: 4,
					formatter: arr => arr.reverse().join('.'),
					encoder: str => str.split('.').reverse()
				})
				.uint16le('port'),
			length: 'numServers'
		}),
	[2019]: new Parser()
		.string('header', { length: 5 })
		.uint32le('numServers')
		.uint32le('unknown')
		.array('servers', {
			type: new Parser()
				.array('address', {
					type: 'uint8',
					length: 4,
					formatter: arr => arr.reverse().join('.'),
					encoder: str => str.split('.').reverse()
				})
				.uint16le('port'),
			length: 'numServers'
		})
};

const gameServerHeaderParser = new Parser()
	.string('header', { length: 5 })
	.uint8('version');

const gameServerParsers = {
	[2012]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.uint8('nibble1')
		.uint8('nibble2')
		.uint8('nibble3')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: str => str.split('\0')[0]
		})
		.uint32le('identifier'),
	[2015]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.uint8('nibble1')
		.uint8('nibble2')
		.uint8('nibble3')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: str => str.split('\0')[0]
		})
		.uint32le('identifier'),
	[2018]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.uint8('nibble1')
		.uint8('nibble2')
		.uint8('nibble3')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: str => str.split('\0')[0]
		})
		.uint32le('identifier')
		.array('address', {
			type: 'uint8',
			length: 4,
			formatter: arr => arr.reverse().join('.'),
			encoder: str => str.split('.').reverse()
		})
		.uint16le('port')
		.bit7('build')
		.bit1('passworded')
		.uint8('clientCompatability')
		.uint8('unknown'),
	[2019]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.uint8('nibble1')
		.uint8('nibble2')
		.uint8('nibble3')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: str => str.split('\0')[0]
		})
		.uint32le('identifier')
		.array('address', {
			type: 'uint8',
			length: 4,
			formatter: arr => arr.reverse().join('.'),
			encoder: str => str.split('.').reverse()
		})
		.uint16le('port')
		.bit7('build')
		.bit1('passworded')
		.uint8('clientCompatability')
		.uint8('unknown')
};

const gameServerRequest = new Parser()
	.endianess('little')
	.string('magic', { length: 4 })
	.uint8('type', { assert: 0 })
	.uint8('version')
	.uint32('timestamp');

async function getMasterServerBuffer(typeByte, client, address, port) {
	return new Promise((resolve, reject) => {
		const requestHeader = Buffer.from([0x37, 0x44, 0x46, 0x50, typeByte]);

		let attemptTimer;
		let attempts = 0;
		const attempt = () => {
			attempts++;
			if (attempts > 10) {
				return reject('Master server did not respond');
			}
			client.send(requestHeader, port, address, err => {
				if (err) {
					return reject(err);
				}
				attemptTimer = setTimeout(attempt, 250);
			});
		};

		client.on('message', (buffer, rinfo) => {
			if (rinfo.address == address && rinfo.port == port) {
				clearTimeout(attemptTimer);
				resolve(buffer);
			}
		});

		attempt();
	});
}

async function getServerList() {
	return new Promise(async resolve => {
		const client = dgram.createSocket('udp4');
		let allResponded = false;

		client.bind({ exclusive: true }, async () => {
			const timestamp = Math.floor(Date.now() / 1000);
			let serverAddresses = [];

			for (const server of masterServerParsers[2019].parse(await getMasterServerBuffer(0x4a, client, '216.55.185.95', 27592)).servers) {
				server.protocol = 2019;
				serverAddresses.push(server);
			}

			for (const server of masterServerParsers[2015].parse(await getMasterServerBuffer(0x4a, client, '216.55.185.95', 27591)).servers) {
				server.protocol = 2015;
				serverAddresses.push(server);
			}

			for (const server of masterServerParsers[2012].parse(await getMasterServerBuffer(0x21, client, '216.55.185.95', 27590)).servers) {
				server.protocol = 2012;	
				serverAddresses.push(server);
			}
		
			const pingPayload = gameServerRequest.encode({
				magic: '7DFP',
				type: 0,
				version: 35,
				timestamp
			});
		
			const servers = [];
			const startTime = Date.now();
		
			client.on('message', (buffer, rinfo) => {
				const server = serverAddresses.find(s => s.address == rinfo.address && s.port == rinfo.port);
				if (server) {
					serverAddresses = serverAddresses.filter(s => s.address != server.address || s.port != server.port);
					try {
						const header = gameServerHeaderParser.parse(buffer);
						if (header.version == 34)
							server.protocol = 2018;
							
						const data = gameServerParsers[server.protocol].parse(buffer);
						if (data.timestamp != timestamp) return;
						
						servers.push({
							address: server.address,
							port: server.port,
							latency: Date.now() - startTime,
							buffer: buffer,
							
							name: data.name,
							version: data.version,
							build: String.fromCharCode(97 + (data.build || 0)),
							clientCompatability: data.clientCompatability || 0,
							passworded: (data.passworded || 0) != 0,
							identifier: data.identifier,
							gameType: nlo(data.nibble1),
							players: (nlo(data.nibble2) << 4) | nhi(data.nibble1),
							maxPlayers: (nlo(data.nibble3) << 4) | nhi(data.nibble2)
						});
					} catch (err) {
						//
					}
					if (serverAddresses.length == 0) {
						allResponded = true;
						client.close();
						resolve(servers);
					}
				}
			});
		
			for (const server of serverAddresses)
				client.send(pingPayload, server.port, server.address);

			setTimeout(() => {
				if (!allResponded) {
					client.close();
					resolve(servers);
				}
			}, 1000);
		});
	});
}

module.exports = getServerList;