// <== Imports externals modules
import http from 'http';
import fs from 'fs';
import {
  client as WsClient,
  connection as Connection,
  Message,
} from 'websocket';
import { DEFAULT_CONFIGURATION } from '..';
import InteliConfig from './tools/InteliConfig';
import InteliAgentSHA256, {
  InteliAgentSHA256Tools,
} from './inteliProtocol/Authentification/InteliAgentSHA256';
import { INTELI_PROTOCOL } from './inteliProtocol/InteliEvent';
import EncodesEnum from './inteliProtocol/enums/EncodesEnum';
import ActionsEnum from './inteliProtocol/enums/ActionsEnum';
import ResolveStatesEnum from './inteliProtocol/enums/ResolveStatesEnum';
import TypesEnum from './inteliProtocol/enums/TypesEnum';
import InteliEventFactory from './inteliProtocol/InteliEventFactory';
import SysAdminEvent from './inteliProtocol/sysAdminEvent/SysAdminEvent';
import getLogger from './tools/logger';
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
  private inteliConfig: InteliConfig;
  private state: ServerStates = ServerStates.CLOSE; // Sysadmin websocket current state
  private wsClient: WsClient = new WsClient({
    tlsOptions: { rejectUnauthorized: false },
  }); // Websocket client instance

  private origin: string; // Websocket client origin

  // Authentification agentId & signature
  private inteliAgentSHA256: InteliAgentSHA256;
  private connection: Connection = null; // Websocket client connection instance

  /**
   * @constructor This provide instance Inteli-reverse-proxy SysAdmin client
   * @param origin Websocket client origin for server CORS check validity
   * @param inteliConfig - Inteli-reverse-proxy configuration (OPTIONNAL - SEE DEFAULT CONFIGURATION)
   */
  constructor(
    origin: string,
    inteliConfig: InteliConfig = DEFAULT_CONFIGURATION
  ) {
    try {
      this.inteliConfig = inteliConfig;
      this.origin = origin;
      this.inteliAgentSHA256 = InteliAgentSHA256Tools.makeInteliAgentSHA256(
        'sysadmin'
      );
    } catch (err) {
      logger.error(
        `An error occured during instanciation of Inteli reverse-proxy sysadmin.\nError message : ${err.message}\nStack: ${err.stack}`
      );
      throw err;
    }
  }

  /**
   * @method ProxySysAdmin#Start Start Inteli-reverse-proxy client
   */
  public start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
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
            connection.on('message', (data: Message) => {
              this.wsClientMessageHandler(this, data);
            });
            this.state = ServerStates.OPEN;
            resolve();
          });

          this.wsClient.on('connectFailed', (err: Error) => {
            logger.error(
              `Inteli reverse-proxy sysadmin event - An error occured when attempted websocket connection.\nError message : ${err.message}\nStack: ${err.stack}`
            );
            this.state = ServerStates.CLOSE;
            reject(err);
          });

          if (this.inteliConfig.secure) {
            this.wsClient.connect(
              `wss://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
              INTELI_PROTOCOL,
              this.origin,
              headers
            );
          } else {
            this.wsClient.connect(
              `ws://${process.env.PROXY_WS_HOST}:${process.env.PROXY_WS_PORT}/`,
              INTELI_PROTOCOL,
              this.origin,
              headers
            );
          }
        } else {
          logger.warn(
            `Inteli reverse-proxy sysadmin connection start attempt aborded: Sysadmin is already start or in intermediate state`
          );
          reject(`ERROR_CLIENT_STATE`);
        }
      } catch (err) {
        logger.error(
          `An error occured when Inteli proxy sysadmin attempt to start.\nError message : ${err.message}\nStack: ${err.stack}`
        );
        reject(err);
      }
    });
  }

  /**
   * @method ProxySysAdmin#Stop Stop Inteli-reverse-proxy client
   */
  public stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          this.state = ServerStates.PENDING;
          setTimeout(() => {
            logger.info(
              `Inteli reverse-proxy sysadmin stop in progress (1 steps) ...`
            );
            if (this.connection.connected) {
              this.connection.close();
            }
            logger.info(
              `Inteli reverse-proxy sysadmin stop (1/1) : websocket client stop`
            );
            this.state = ServerStates.CLOSE;
            resolve();
          }, this.inteliConfig.sysadmin.closeTimeout);
        } else {
          logger.warn(
            `Inteli reverse-proxy sysadmin stop attempt aborded: Sysadmin is already stop or in intermediate state`
          );
          reject(`ERROR_CLIENT_STATE`);
        }
      } catch (err) {
        logger.error(
          `An error occured when Inteli reverse-proxy sysadmin attempted to stop.\nError message : ${err.message}\nStack: ${err.stack}`
        );
        reject(err);
      }
    });
  }

  /**
   * @method ProxySysAdmin#wsClientCloseHandler That will occured if connection close
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
      `Inteli reverse-proxy sysadmin disconnected, reason : [${code} - ${desc}]`
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
  private wsClientMessageHandler(_this: ProxySysAdmin, data: Message) {
    if (data.type === EncodesEnum.utf8) {
      logger.warn(
        `Inteli reverse-proxy sysadmin receive utf8 message : <${data.utf8Data}>`
      );
    }
    if (data.type === EncodesEnum.binary) {
      logger.warn(
        `Inteli reverse-proxy sysadmin receive binary message : <${data.binaryData}>`
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
      `Error append on websocket client.\nError message : ${err.message}\nStack: ${err.stack}`
    );
    if (_this.state === ServerStates.OPEN) {
      _this.stop();
    }
  }

  public send(
    type: Exclude<string, TypesEnum>,
    action: string,
    payload: any
  ): Promise<ResolveStatesEnum> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          const sendPayload: string = JSON.stringify(
            InteliEventFactory.makeInteliEvent(
              type,
              action,
              this.inteliAgentSHA256,
              payload
            )
          );
          this.connection.send(sendPayload, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(ResolveStatesEnum.VALID);
            }
          });
        } else {
          resolve(ResolveStatesEnum.UNVAILABLE);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  public addPublicKey(
    hostId: string,
    publicKeyFilePath: string
  ): Promise<ResolveStatesEnum> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          let publicKey: string = '';
          if (fs.existsSync(publicKeyFilePath)) {
            publicKey = fs.readFileSync(publicKeyFilePath, 'utf8');
          } else {
            resolve(ResolveStatesEnum.INVALID);
          }
          const sysAdminEvent: SysAdminEvent = InteliEventFactory.makeSysAdminEvent(
            ActionsEnum.add,
            this.inteliAgentSHA256,
            { hostId, publicKey }
          );
          const sendPayload: string = JSON.stringify(sysAdminEvent);
          this.connection.send(sendPayload, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(ResolveStatesEnum.VALID);
            }
          });
        } else {
          resolve(ResolveStatesEnum.UNVAILABLE);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  public removePublicKey(hostId: string): Promise<ResolveStatesEnum> {
    return new Promise((resolve, reject) => {
      try {
        if (this.state === ServerStates.OPEN) {
          const sysAdminEvent: SysAdminEvent = InteliEventFactory.makeSysAdminEvent(
            ActionsEnum.remove,
            this.inteliAgentSHA256,
            { hostId }
          );
          const sendPayload: string = JSON.stringify(sysAdminEvent);
          this.connection.send(sendPayload, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(ResolveStatesEnum.VALID);
            }
          });
        } else {
          resolve(ResolveStatesEnum.UNVAILABLE);
        }
      } catch (err) {
        reject(err);
      }
    });
  }
}

export default ProxySysAdmin;
