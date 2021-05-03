export default interface InteliConfig {
  secure: boolean;
  wsServerMount: {
    keepalive: true;
    keepaliveInterval: number;
    dropConnectionOnKeepaliveTimeout: boolean;
    keepaliveGracePeriod: number;
    autoAcceptConnections: boolean;
    closeTimeout: number;
    disableNagleAlgorithm: boolean;
    ignoreXForwardedFor: boolean;
  };
  webserver: {
    version: string;
    closeTimeout: number;
  };
  sysadmin: {
    closeTimeout: number;
  };
  proxyserver: {
    closeTimeout: number;
  };
}
export const DEFAULT_CONFIGURATION: InteliConfig = {
  secure: false,
  wsServerMount: {
    keepalive: true,
    keepaliveInterval: 20000,
    dropConnectionOnKeepaliveTimeout: true,
    keepaliveGracePeriod: 10000,
    autoAcceptConnections: false,
    closeTimeout: 5000,
    disableNagleAlgorithm: true,
    ignoreXForwardedFor: false,
  },
  webserver: {
    version: '1.0.0',
    closeTimeout: 1000,
  },
  sysadmin: {
    closeTimeout: 500,
  },
  proxyserver: {
    closeTimeout: 500,
  },
};
