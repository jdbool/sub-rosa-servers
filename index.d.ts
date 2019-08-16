declare interface ServerData {
  address: string;
  port: number;
  latency: number;
  buffer: Buffer;
  name: string;
  version: number;
  build: string;
  clientCompatability: number;
  passworded: boolean;
  identifier: number;
  gameType: number;
  players: number;
  maxPlayers: number;
}

export declare function getServerList(): Promise<ServerData[]>;
