// Imports externals modules
import { connection, client as WsSocketClient } from 'websocket';
import ProxyEvent from '../inteliProtocol/proxyEvent/ProxyEvent';
import InteliEventFactory from '../inteliProtocol/InteliEventFactory';
import ActionEnum from '../inteliProtocol/EventActions';
import clientConfig from './clientConfig.json';

/**
 * @class ProxyClient - This Class referred to the wsClient not the Final Client (Browser)
 * @version 1.00
 */

class ProxyClient {
  private wsClient: WsSocketClient = new WsSocketClient();
  private domain: string;
  private port: number;
  private connection: connection;

  /**
   * @constructor This provide instance of Inteli-proxy WS Client connection
   * @param domain - Strictly your WS Client domain - default value as an example
   * @param port - Strictly your WS Client port - default value as an example
   */

  constructor(domain: string = 'my.domain.com', port: number = 3080) {
    this.domain = domain;
    this.port = port;
    this.wsClient.on('connectFailed', this.wsClientConnectFailedHandler);
    this.wsClient.on('connect', this.wsClientConnectHandler);
  }

  /**
   * @method ProxyClient#Open Attempt to open connection to the server
   */

  open() {
    this.wsClient.connect(`ws://${this.domain}/${this.port}`);
  }

  /**
   * @method ProxyClient#Close Attempt to close connection to the server
   */

  close() {
    if (this.connection) {
      this.connection.close();
      console.log('Client want to close');
    }
  }

  /**
   * @method ProxyClient#wsClientConnectFailedHandler Deal with error from the connection attempt
   */

  wsClientConnectFailedHandler(error: Error) {
    console.error(error);
    throw error;
  }

  /**
   * @method ProxyClient#wsClientConnectHandler That will occured if connection succeeds
   * @param connection WS Client connection object
   */

  wsClientConnectHandler(connection: connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function (error) {
      console.error(error);
    });
    connection.on('close', function () {
      console.log('Connection Closed by Server');
      this.connection = null;
    });
    connection.on('message', function (message) {
      if (message.type === 'utf8') {
        console.log("Received: '" + message.utf8Data + "'");
      }
    });
    this.connection = connection;
    const openProxyEvent: ProxyEvent = InteliEventFactory.makeProxyEvent(
      ActionEnum.open,
      '',
      clientConfig.host,
      clientConfig.port
    );

    connection.send(JSON.stringify(openProxyEvent));
  }
}

export default ProxyClient;
