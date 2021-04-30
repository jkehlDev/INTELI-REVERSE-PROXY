interface Host {
  hostId: string;
  version: string;
  rule: string;
  target: {
    host: string;
    port: number;
  };
  options?: any;
}

export default Host;
