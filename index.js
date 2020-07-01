const dgram = require('dgram');
const { Parser } = require('binary-parser-encoder');

const masterServerParsers = {
	[2012]: new Parser()
		.string('header', { length: 5 })
		.uint32le('numServers')
		.array('servers', {
			type: new Parser()
				.array('address', {
					type: 'uint8',
					length: 4,
					formatter: (arr) => arr.reverse().join('.'),
					encoder: (str) => str.split('.').reverse(),
				})
				.uint16le('port'),
			length: 'numServers',
		}),
	[2015]: new Parser()
		.string('header', { length: 5 })
		.uint32le('numServers')
		.array('servers', {
			type: new Parser()
				.array('address', {
					type: 'uint8',
					length: 4,
					formatter: (arr) => arr.reverse().join('.'),
					encoder: (str) => str.split('.').reverse(),
				})
				.uint16le('port'),
			length: 'numServers',
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
					formatter: (arr) => arr.reverse().join('.'),
					encoder: (str) => str.split('.').reverse(),
				})
				.uint16le('port'),
			length: 'numServers',
		}),
};

const gameServerHeaderParser = new Parser()
	.string('header', { length: 5 })
	.uint8('version');

const gameServerParsers = {
	[2012]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.bit4('playersLow')
		.bit4('gameType')
		.bit4('maxPlayersLow')
		.bit4('playersHigh')
		.bit4('unknown1')
		.bit4('maxPlayersHigh')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: (str) => str.split('\0')[0],
		})
		.uint32le('identifier'),
	[2015]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.bit4('playersLow')
		.bit4('gameType')
		.bit4('maxPlayersLow')
		.bit4('playersHigh')
		.bit4('unknown1')
		.bit4('maxPlayersHigh')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: (str) => str.split('\0')[0],
		})
		.uint32le('identifier'),
	[2018]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.bit4('playersLow')
		.bit4('gameType')
		.bit4('maxPlayersLow')
		.bit4('playersHigh')
		.bit4('unknown1')
		.bit4('maxPlayersHigh')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: (str) => str.split('\0')[0],
		})
		.uint32le('identifier')
		.array('address', {
			type: 'uint8',
			length: 4,
			formatter: (arr) => arr.reverse().join('.'),
			encoder: (str) => str.split('.').reverse(),
		})
		.uint16le('port')
		.bit7('build')
		.bit1('passworded')
		.bit7('clientCompatability')
		.bit9('unknown2'),
	[2019]: new Parser()
		.string('header', { length: 5 })
		.uint8('version')
		.uint32le('timestamp')
		.bit4('playersLow')
		.bit4('gameType')
		.bit4('maxPlayersLow')
		.bit4('playersHigh')
		.bit4('unknown1')
		.bit4('maxPlayersHigh')
		.string('name', {
			encoding: 'ascii',
			length: 32,
			formatter: (str) => str.split('\0')[0],
		})
		.uint32le('identifier')
		.array('address', {
			type: 'uint8',
			length: 4,
			formatter: (arr) => arr.reverse().join('.'),
			encoder: (str) => str.split('.').reverse(),
		})
		.uint16le('port')
		.bit7('build')
		.bit1('passworded')
		.bit7('clientCompatability')
		.bit9('unknown2'),
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
			if (attempts > 10) return;
			client.send(requestHeader, port, address, (err) => {
				if (err) return reject(err);
			});
		};

		client.on('message', (buffer, rinfo) => {
			if (rinfo.address == address && rinfo.port == port) {
				clearInterval(attemptTimer);
				resolve(buffer);
			}
		});

		attemptTimer = setInterval(attempt, 5);

		setTimeout(() => {
			clearInterval(attemptTimer);
			reject('No response');
		}, 200);
	});
}

async function getServerList() {
	return new Promise(async (resolve) => {
		const client = dgram.createSocket('udp4');
		let allResponded = false;

		client.bind({ exclusive: true }, async () => {
			const timestamp = Math.floor(Date.now() / 1000);
			let serverAddresses = [];

			try {
				const buffer = await getMasterServerBuffer(
					0x4a,
					client,
					'66.226.72.227',
					27592
				);
				for (const server of masterServerParsers[2019].parse(buffer).servers) {
					server.protocol = 2019;
					serverAddresses.push(server);
				}
			} catch (err) {
				//
			}

			try {
				const buffer = await getMasterServerBuffer(
					0x4a,
					client,
					'66.226.72.227',
					27591
				);
				for (const server of masterServerParsers[2015].parse(buffer).servers) {
					server.protocol = 2015;
					serverAddresses.push(server);
				}
			} catch (err) {
				//
			}

			try {
				const buffer = await getMasterServerBuffer(
					0x21,
					client,
					'66.226.72.227',
					27590
				);
				for (const server of masterServerParsers[2012].parse(buffer).servers) {
					server.protocol = 2012;
					serverAddresses.push(server);
				}
			} catch (err) {
				//
			}

			const pingPayload = gameServerRequest.encode({
				magic: '7DFP',
				type: 0,
				version: 35,
				timestamp,
			});

			const servers = [];
			const startTime = Date.now();

			client.on('message', (buffer, rinfo) => {
				const server = serverAddresses.find(
					(s) => s.address == rinfo.address && s.port == rinfo.port
				);
				if (server) {
					serverAddresses = serverAddresses.filter(
						(s) => s.address != server.address || s.port != server.port
					);
					try {
						const header = gameServerHeaderParser.parse(buffer);
						if (header.version == 34) server.protocol = 2018;

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
							gameType: data.gameType,
							players: (data.playersHigh << 4) | data.playersLow,
							maxPlayers: (data.maxPlayersHigh << 4) | data.maxPlayersLow,
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
