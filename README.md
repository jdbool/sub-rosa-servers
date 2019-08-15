# sub-rosa-servers

Grab info about currently running Sub Rosa servers. Simple Promise API that gives you an array of server objects.

## Installation
```shell
npm install sub-rosa-servers
```

## Example

```javascript
const getServers = require('sub-rosa-servers');

// Usage
const servers = await getServers();
for (const server of servers) {
  if (server.players > 0) {
    console.log(`${server.players} people playing on ${server.name}!`);
  }
}
```

## Server Object

Key | Type | Description
--- | --- | ---
`address` | string | IP of the server (x.x.x.x)
`port` | number
`latency` | number | Response time in milliseconds
`name` | string | Public server title
`version` | number | *Ex. 35*
`build` | string | *Ex. 'b'*
`passworded` | boolean
`gameType` | number | *Ex. 3 = round*
`players` | number | How many people are connected
`maxPlayers` | number
`identifier` | number | Unique ID the server assigns to itself, stored in server.srk. **Not guaranteed to be unique** because people copy/paste files.
`clientCompatability` | number | Hidden build number used to indicate which clients can join this server — it appears red and unclickable in the list if it isn't the same as the client's
`buffer` | [Buffer](https://nodejs.org/api/buffer.html) | Raw binary ping response from the server