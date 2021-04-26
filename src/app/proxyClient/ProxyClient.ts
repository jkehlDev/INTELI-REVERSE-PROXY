// <== Imports externals modules
import {
  connection as Connection,
  client as WsClient,
  IMessage,
} from 'websocket';
import ClientEvent from 'app/inteliProtocol/clientEvent/ClientEvent';
import InteliEventFactory from 'app/inteliProtocol/InteliEventFactory';
import ActionEnum from 'app/inteliProtocol/EventActions';
import http from 'http';
import https from 'https';
import EventEncode from 'app/inteliProtocol/EventEncode';
import wsConfig from 'wsConfig.json';
import InteliSHA256, {
  InteliSHA256Factory,
} from 'app/inteliProtocol/Authentification/InteliSHA256';
import fs from 'fs';
// ==>

enum ServerStates {
  CLOSE,
  PENDING,
  OPEN,
}

/**
 * @class ProxyClient - This provide Inteli-reverse-proxy client class
 * @version 1.00
 */
class ProxyClient {
  private state: ServerStates = ServerStates.CLOSE; // Server current state

  private wsClient: WsClient = new WsClient(); // Websocket client instance
  private httpServer: http.Server | https.Server; // Http/Https server instance

  // Authentification agentId & signature
  private inteliSHA256: InteliSHA256;
  // TIPS https://nodejs.org/api/crypto.html#crypto_class_sign

  private host: string; // Http/Https server host domain
  private port: number; // Http/Https server port
  private connection: Connection = null; // Websocket client connection instance

  /**
   * @constructor This provide instance Inteli-reverse-proxy client (back-end http server)
   * @param host - http server host to provide acces to the Inteli-reverse-proxy server
   * @param port - http server port to provide acces to the Inteli-reverse-proxy server
   * @param agentId - Client identifiant
   * @param clientPrivateKeyFileName  - Client private key Cert file name
   * @param httpServer - CLient http/https server
   */
  constructor(
    host: string,
    port: number,
    agentId: string,
    clientPrivateKeyFileName: string,
    httpServer: http.Server | https.Server
  ) {
    this.host = host;
    this.port = port;
    try {
      if (fs.existsSync(`${process.cwd()}/${clientPrivateKeyFileName}.pem`)) {
        this.inteliSHA256 = InteliSHA256Factory.makeInteliSHA256(
          agentId,
          clientPrivateKeyFileName
        );
      } else {
        throw new Error(
          `client private key don't exist : ${process.cwd()}/${clientPrivateKeyFileName}.pem`
        );
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
    this.httpServer = httpServer;
    this.wsClient.on('connectFailed', (err: Error) => {
      this.wsClientConnectFailedHandler(this, err);
    });
    this.wsClient.on('connect', (connection: Connection) => {
      this.wsClientConnectHandler(this, connection);
    });
  }

  /**
   * @method ProxyClient#Start Start Inteli-reverse-proxy client
   */
  public start() {
    if (this.state === ServerStates.CLOSE) {
      this.state = ServerStates.PENDING;
      const headers: http.OutgoingHttpHeaders = {
        Authorization: `INTELI-SHA256 AgentId=${this.inteliSHA256.agentId}, Signature=${this.inteliSHA256.signature}`,
      };
      this.wsClient.connect(
        `ws://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
        'inteli',
        'localhost',
        headers
      );      
    } else {
      console.warn(
        `Starting client aborded because client already start or in pending situation`
      );
    }
  }

  /**
   * @method ProxyClient#Stop Stop Inteli-reverse-proxy client
   */
  public stop() {
    if (this.state === ServerStates.OPEN) {
      this.state = ServerStates.PENDING;
      this.connection.close();
      setTimeout(() => {
        if (this.httpServer.listening) {
          this.httpServer.close((err?: Error) => {
            this.httpServerCloseHandler(this, err);
          });
        }
      }, wsConfig.closeTimeout);      
    } else {
      console.warn(
        `Stopping client aborded because client already stop or in pending situation`
      );
    }
  }

  /**
   * @method ProxyClient#wsClientConnectFailedHandler Deal with error from the connection attempt
   * @param _this Class instance context
   * @param err Error send by server when client attempt to connect
   */
  private wsClientConnectFailedHandler(_this: ProxyClient, err: Error) {
    console.error(err);
    this.state = ServerStates.CLOSE;
    throw err;
  }

  /**
   * @method ProxyClient#wsClientConnectHandler That will occured if connection succeeds
   * @param _this Class instance context
   * @param connection WS Client connection object
   */
  private wsClientConnectHandler(_this: ProxyClient, connection: Connection) {
    _this.connection = connection;
    connection.on('error', (err: Error) => {
      _this.wsClientErrorHandler(_this, err);
    });
    connection.on('close', (code: number, desc: string) => {
      _this.wsClientCloseHandler(_this, code, desc);
    });
    connection.on('message', (data: IMessage) => {
      _this.wsClientMessageHandler(_this, data);
    });

    console.log('Client connection to Inteli-reverse-proxy server success');
    _this.httpServer.listen(_this.port, () => {
      _this.httpServerListenHandler(_this);
    });
  }

  /**
   * @method ProxyClient#wsClientCloseHandler That will occured if connection close by server
   * @param _this Class instance context
   * @param code Close reason code send by server
   * @param desc Close description reason send by server
   */
  private wsClientCloseHandler(_this: ProxyClient, code: number, desc: string) {
    console.log(`WebSocket client disconnected, reason : ${code} - ${desc}`);
    _this.stop();
  }

  /**
   * @method ProxyClient#wsClientMessageHandler That will occured if message send by server
   * @param _this Class instance context
   * @param data Message data content
   */
  private wsClientMessageHandler(_this: ProxyClient, data: IMessage) {
    if (data.type === EventEncode.utf8) {
      console.log(`Receive message from server : ${data.utf8Data}`);
    }
    if (data.type === EventEncode.binary) {
      console.log(`Receive message from server : ${data.binaryData}`);
    }
  }

  /**
   * @method ProxyClient#wsClientErrorHandler That will occured if an error send by server
   * @param _this Class instance context
   * @param err Error send by server
   */
  private wsClientErrorHandler(_this: ProxyClient, err: Error) {
    console.error(err);
    _this.stop();
    throw err;
  }

  /**
   * @method ProxyClient#httpServerListenHandler That will occured if http server start listening
   * @param _this Class instance context
   */
  private httpServerListenHandler(_this: ProxyClient) {
    console.log(`HTTP server is listening on port [${_this.port}]`);
    const openProxyEvent: ClientEvent = InteliEventFactory.makeProxyEvent(
      ActionEnum.open,
      _this.inteliSHA256,
      _this.host,
      _this.port
    );
    console.log(`Send <open> instruction to Inteli-reverse-proxy`);
    _this.connection.send(JSON.stringify(openProxyEvent));
    this.state = ServerStates.OPEN;
  }

  /**
   * @method ProxyClient#httpServerListenHandler That will occured if http server close
   * @param _this Class instance context
   * @param err Error if error occured
   */
  private httpServerCloseHandler(_this: ProxyClient, err?: Error) {
    if (err) {
      console.error(err);
    } else {
      console.log(`HTTP server close.`);
      this.state = ServerStates.CLOSE;
    }
  }
}

export default ProxyClient;
