interface Host {
  hostId: string;
  version: string;
  rule: string;
  use?: number;
  pending?: boolean;
  target: {
    host: string;
    port: number;
  };
}

export default Host;
