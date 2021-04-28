// <== Imports externals modules
import InteliAgentSHA256, {
  InteliSHA256Factory,
} from 'app/inteliProtocol/Authentification/InteliAgentSHA256';
import EventEncode from 'app/inteliProtocol/enums/EventEncode';
import http from 'http';
import {
  client as WsClient,
  connection as Connection,
  IMessage,
} from 'websocket';
import fs from 'fs';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import InteliEventFactory from 'app/inteliProtocol/InteliEventFactory';
import SysAdminEvent from 'app/inteliProtocol/sysAdminEvent/SysAdminEvent';
import inteliConfig from 'inteliProxyConfig.json';
import getLogger from 'app/tools/logger';
// ==>
// LOGGER INSTANCE
const logger = getLogger('ProxySysAdmin');

enum ServerStates {
  CLOSE,
  PENDING,
  OPEN,
}

/**
 * @class ProxySysAdmin - This provide Inteli-reverse-proxy system administration class
 * @version 1.00
 */
class ProxySysAdmin {
  private state: ServerStates = ServerStates.CLOSE; // Sysadmin websocket current state
  private wsClient: WsClient = new WsClient(); // Websocket client instance

  private origin: string; // Websocket client origin

  // Authentification agentId & signature
  private inteliAgentSHA256: InteliAgentSHA256;
  private connection: Connection = null; // Websocket client connection instance

  /**
   * @constructor This provide instance Inteli-reverse-proxy SysAdmin client
   * @param origin Websocket client origin for server CORS check validity
   */
  constructor(origin: string) {
    try {
      this.inteliAgentSHA256 = InteliSHA256Factory.makeInteliAgentSHA256(
        'sysadmin'
      );
    } catch (err) {
      logger.error(
        `An error occured during instanciation of Inteli reverse-proxy sysadmin.
          Error message : ${err.message}
          Stack: ${err.stack}
        `
      );
      throw err;
    }
  }

  /**
   * @method ProxySysAdmin#Start Start Inteli-reverse-proxy client
   */
  public start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.state === ServerStates.CLOSE) {
        logger.info(
          `Inteli reverse-proxy sysadmin connection start in progress (1 steps)...`
        );

        this.state = ServerStates.PENDING;

        const headers: http.OutgoingHttpHeaders = {
          Authorization: `INTELI-SHA256 AgentId=${this.inteliAgentSHA256.agentId}, Signature=${this.inteliAgentSHA256.signature}`,
        };

        this.wsClient.on('connect', (connection: Connection) => {
          this.connection = connection;
          connection.on('error', (err: Error) => {
            this.wsClientErrorHandler(this, err);
          });
          connection.on('close', (code: number, desc: string) => {
            this.wsClientCloseHandler(this, code, desc);
          });
          connection.on('message', (data: IMessage) => {
            this.wsClientMessageHandler(this, data);
          });
          this.state = ServerStates.OPEN;
          resolve();
        });

        this.wsClient.on('connectFailed', (err: Error) => {
          logger.error(
            `Inteli reverse-proxy sysadmin event - An error occured when attempted websocket connection
              Error message : ${err.message}
              Stack: ${err.stack}`
          );
          this.state = ServerStates.CLOSE;
          reject(err);
        });

        this.wsClient.connect(
          `ws://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
          inteliConfig.wsprotocol,
          this.origin,
          headers
        );
      } else {
        logger.warn(
          `Inteli reverse-proxy sysadmin connection start attempt aborded: Sysadmin is already start or in intermediate state`
        );
        reject(`ERROR_CLIENT_STATE`);
      }
    });
  }

  /**
   * @method ProxySysAdmin#Stop Stop Inteli-reverse-proxy client
   */
  public stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.state === ServerStates.OPEN) {
        this.state = ServerStates.PENDING;
        try {
          logger.info(
            `Inteli reverse-proxy sysadmin stop in progress (1 steps) ...`
          );
          this.connection.close();
          logger.info(
            `Inteli reverse-proxy sysadmin stop (1/1) : websocket client stop`
          );
        } catch (err) {
          logger.error(
            `An error occured when Inteli reverse-proxy sysadmin attempted to stop 
              Error message : ${err.message}
              Stack: ${err.stack}`
          );
          reject(err);
        }
        this.state = ServerStates.CLOSE;
        resolve();
      } else {
        logger.warn(
          `Inteli reverse-proxy sysadmin stop attempt aborded: Sysadmin is already stop or in intermediate state`
        );
        reject(`ERROR_CLIENT_STATE`);
      }
    });
  }

  /**
   * @method ProxySysAdmin#wsClientCloseHandler That will occured if connection close by server
   * @param _this Class instance context
   * @param code Close reason code send by server
   * @param desc Close description reason send by server
   */
  private wsClientCloseHandler(
    _this: ProxySysAdmin,
    code: number,
    desc: string
  ) {
    logger.info(
      `Inteli reverse-proxy sysadmin disconnected, reason : ${code} - ${desc}`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }

  /**
   * @method ProxySysAdmin#wsClientMessageHandler That will occured if message send by server
   * @param _this Class instance context
   * @param data Message data content
   */
  private wsClientMessageHandler(_this: ProxySysAdmin, data: IMessage) {
    if (data.type === EventEncode.utf8) {
      logger.warn(
        `Inteli reverse-proxy sysadmin receive utf8 message : <${data.utf8Data}>`
      );
    }
    if (data.type === EventEncode.binary) {
      logger.warn(
        `Inteli reverse-proxy sysadmin receive binary message : <${data.utf8Data}>`
      );
    }
  }

  /**
   * @method ProxySysAdmin#wsClientErrorHandler That will occured if an error send by server
   * @param _this Class instance context
   * @param err Error send by server
   */
  private wsClientErrorHandler(_this: ProxySysAdmin, err: Error) {
    logger.error(
      `Inteli reverse-proxy sysadmin event - An error occured when attempted to stop web server
        Error message : ${err.message}
        Stack: ${err.stack}`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }

  public send(
    action: ActionEnum.add | ActionEnum.remove,
    hostId: string,
    publicKeyFilePath: string = undefined
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          let publicKey: string = '';
          if (publicKeyFilePath && fs.existsSync(publicKeyFilePath)) {
            publicKey = fs.readFileSync(publicKeyFilePath, 'utf8');
          }
          const sysAdminEvent: SysAdminEvent = InteliEventFactory.makeSysAdminEvent(
            action,
            this.inteliAgentSHA256,
            hostId,
            publicKey
          );
          const sendPayload: string = JSON.stringify(sysAdminEvent);
          logger.info(
            `Sending event to Inteli reverse-proxy server : ${sendPayload}`
          );
          this.connection.send(sendPayload);
          resolve();
        } else {
          logger.warn(
            `Can't send event to Inteli reverse-proxy server, sysadmin client not connected or in pendding state`
          );
          reject('ERROR_CLIENT_STATE');
        }
      } catch (err) {
        logger.error(err);
      }
    });
  }
}

export default ProxySysAdmin;
