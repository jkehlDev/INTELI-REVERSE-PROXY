export default interface InteliConfig {
  secure: boolean;
  TSLCertifacts: {
    certFilePath: string;
    keyFilePath: string;
  };
  wsprotocol: string;
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
