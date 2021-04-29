interface Host {
  hostId: string;
  version: string;
  rule: string;
  use?: number;
  target: {
    host: string;
    port: number;
  };
}

export default Host;
