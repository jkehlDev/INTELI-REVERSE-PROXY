// <== Imports externals modules
import { connection as Connection, client as WsClient, IMessage } from 'websocket';
import ClientEvent from 'app/inteliProtocol/clientEvent/ClientEvent';
import InteliEventFactory from 'app/inteliProtocol/InteliEventFactory';
import ActionEnum from 'app/inteliProtocol/EventActions';
import http from 'http';
import https from 'https';
import EventEncode from 'app/inteliProtocol/EventEncode';
import wsConfig from 'app/proxyServer/wsConfig.json';
// ==>

/**
 * @class ProxyClient - This provide Inteli-reverse-proxy client class
 * @version 1.00
 */
class ProxyClient {
  private wsClient: WsClient = new WsClient(); // Websocket client instance
  private httpServer: http.Server | https.Server; // Http/Https server instance
  private host: string; // Http/Https server host domain
  private port: number; // Http/Https server port
  private connection: Connection = null; // Websocket client connection instance

  /**
   * @constructor This provide instance Inteli-reverse-proxy client (back-end http server)
   * @param host - http server host to provide acces to the Inteli-reverse-proxy server
   * @param port - http server port to provide acces to the Inteli-reverse-proxy server
   */
  constructor(
    host: string,
    port: number,
    httpServer: http.Server | https.Server
  ) {
    this.host = host;
    this.port = port;
    this.httpServer = httpServer;
    this.wsClient.on('connectFailed', this.wsClientConnectFailedHandler);
    this.wsClient.on('connect', this.wsClientConnectHandler);
  }

  /**
   * @method ProxyClient#Start Start Inteli-reverse-proxy client
   */
  start() {
    if (this.connection === null) {
      // TODO ENCRYPTED SHA256 signed UserId
      // https://nodejs.org/api/crypto.html#crypto_class_sign
      const headers: http.OutgoingHttpHeaders = { Authorization: 'INTELI-SHA256 AgentId=<agentId>, Signature=<sha256 signature>' };
      this.wsClient.connect(
        `ws://${process.env.PROXY_HOST}/${process.env.PROXY_WS_PORT}`,
        null,
        null,
        headers
      );
    } else {
      console.warn(`Starting client aborded because client already start.`);
    }
  }

  /**
   * @method ProxyClient#Stop Stop Inteli-reverse-proxy client
   */
  stop() {
    if (this.connection !== null) {
      this.connection.close();
    } else {
      console.warn(`Stopping client aborded because client already stop.`);
    }
    if (this.httpServer.listening) {
      setTimeout(() => {
        this.httpServer.close(this.httpServerCloseHandler);
      }, wsConfig.closeTimeout);
    }
  }

  /**
   * @method ProxyClient#wsClientConnectFailedHandler Deal with error from the connection attempt
   * @param err Error send by server when client attempt to connect
   */
  wsClientConnectFailedHandler(err: Error) {
    console.error(err);
  }

  /**
   * @method ProxyClient#wsClientConnectHandler That will occured if connection succeeds
   * @param connection WS Client connection object
   */
  wsClientConnectHandler(connection: Connection) {
    this.connection = connection;
    connection.on('error', this.wsClientErrorHandler);
    connection.on('close', this.wsClientCloseHandler);
    connection.on('message', this.wsClientMessageHandler);

    console.log('Client connection to Inteli-reverse-proxy server success');
    this.httpServer.listen(this.port, this.httpServerListenHandler);
  }

  /**
   * @method ProxyClient#wsClientCloseHandler That will occured if connection close by server
   * @param code Close reason code send by server
   * @param desc Close description reason send by server
   */
  private wsClientCloseHandler(code: number, desc: string) {
    console.log(`WebSocket client disconnected, reason : ${code} - ${desc}`);
    this.connection = null;
    if (this.httpServer.listening) {
      setTimeout(() => {
        this.httpServer.close(this.httpServerCloseHandler);
      }, wsConfig.closeTimeout);
    }
  }

  /**
   * @method ProxyClient#wsClientMessageHandler That will occured if message send by server
   * @param data Message data content
   */
  private wsClientMessageHandler(data: IMessage) {
    if (data.type === EventEncode.utf8) {
      console.log(`Receive message from server : ${data.utf8Data}`);
    }
    if (data.type === EventEncode.binary) {
      console.log(`Receive message from server : ${data.binaryData}`);
    }
  }

  /**
   * @method ProxyClient#wsClientErrorHandler That will occured if an error send by server
   * @param err Error send by server
   */
  private wsClientErrorHandler(err: Error) {
    console.error(err);
  }

  /**
   * @method ProxyClient#httpServerListenHandler That will occured if http server start listening
   */
  private httpServerListenHandler() {
    console.log(`HTTP server is listening on port [${this.port}]`);
    const openProxyEvent: ClientEvent = InteliEventFactory.makeProxyEvent(
      ActionEnum.open,
      '', // TODO agetId and signature SHA 256
      '',
      this.host,
      this.port
    );
    console.log(`Send <open> instruction to Inteli-reverse-proxy`);
    this.connection.send(JSON.stringify(openProxyEvent));
  }

  /**
   * @method ProxyClient#httpServerListenHandler That will occured if http server close
   * @param err Error if error occured
   */
  private httpServerCloseHandler(err?: Error) {
    if (err) {
      console.error(err);
    } else {
      console.log(`HTTP server close.`);
    }
  }
}

export default ProxyClient;
