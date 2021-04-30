// <== Imports externals modules
import fs from 'fs';
import { connection as Connection, IMessage } from 'websocket';
import { inteliSHA256CheckValidity } from '../inteliProtocol/Authentification/InteliAgentSHA256';
import ResolveStatesEnum from '../inteliProtocol/enums/ResolveStatesEnum';
import ActionsEnum from '../inteliProtocol/enums/ActionsEnum';
import EncodesEnum from '../inteliProtocol/enums/EncodesEnum';
import TypesEnum from '../inteliProtocol/enums/TypesEnum';
import InteliEvent from '../inteliProtocol/InteliEvent';
import SysAdminEvent from '../inteliProtocol/sysAdminEvent/SysAdminEvent';
import WebServerEvent from '../inteliProtocol/webServerEvent/WebServerEvent';
import ProxySelector from './ProxySelector';
import getLogger from './logger';
// ==>
// LOGGER INSTANCE
const logger = getLogger('ProxyMsgHandler');
const PROXY_ENCRYPT_CERTSTORE: string =
  process.env.PROXY_ENCRYPT_CERTSTORE || 'certstore';
export default abstract class ProxyMsgHandler {
  /**
   * @method ProxyMsgHandler#wsCliMessageHandler WS connection message event handler
   * @param connection WS client connection object
   * @param proxySelector Instance of ProxySelector
   * @param data WS client connection IMessage object
   * @returns {Promise<ResolveState>} Resolution state or reject with error object
   */
  public msgHandler(
    connection: Connection,
    proxySelector: ProxySelector,
    data: IMessage
  ): Promise<ResolveStatesEnum> {
    return new Promise((resolve, reject) => {
      try {
        if ((data.type = EncodesEnum.utf8)) {
          const event: InteliEvent<
            TypesEnum,
            ActionsEnum,
            any,
            any
          > = JSON.parse(data.utf8Data);
          if (inteliSHA256CheckValidity(event.authentification)) {
            switch (event.header.type) {
              case TypesEnum.sysadmin:
                return this.resolveSysAdminMsg(event as SysAdminEvent);
              case TypesEnum.webServer:
                return this.resolveWebServerMsg(
                  connection,
                  proxySelector,
                  event as WebServerEvent
                );
              default:
                return this.resolvePersonalizedMsg(
                  connection,
                  proxySelector,
                  event
                );
            }
          } else {
            resolve(ResolveStatesEnum.UNAUTHORIZED);
          }
        } else {
          resolve(ResolveStatesEnum.INVALID);
        }
      } catch (err) {
        reject(err);
      }
    });
  }
  private resolveSysAdminMsg(event: SysAdminEvent): Promise<ResolveStatesEnum> {
    return new Promise((resolve, reject) => {
      try {
        switch (event.header.action) {
          case ActionsEnum.add:
            logger.info(
              `Sysadmin add public certificat to [${PROXY_ENCRYPT_CERTSTORE}]event received for agentID:[${event.payload.hostId}].`
            );
            fs.writeFileSync(
              `${process.cwd()}/${PROXY_ENCRYPT_CERTSTORE}/${
                event.payload.hostId
              }_publicKey.pem`,
              event.payload.publicKey
            );
            resolve(ResolveStatesEnum.VALID);
            break;
          case ActionsEnum.remove:
            logger.info(
              `Sysadmin remove public certificat from [${PROXY_ENCRYPT_CERTSTORE}] event received for agentID:[${event.payload.hostId}].`
            );
            fs.rmSync(
              `${process.cwd()}/${PROXY_ENCRYPT_CERTSTORE}/${
                event.payload.hostId
              }_publicKey.pem`
            );
            resolve(ResolveStatesEnum.VALID);
            break;
          case ActionsEnum.stopproxy:
            logger.info(`Sysadmin stop proxy request received.`);
            // TODO STOP PROXY ACTION
            resolve(ResolveStatesEnum.VALID);
            break;
          default:
            resolve(ResolveStatesEnum.INVALID);
            break;
        }
      } catch (err) {
        reject(err);
      }
    });
  }
  private resolveWebServerMsg(
    connection: Connection,
    proxySelector: ProxySelector,
    event: WebServerEvent
  ): Promise<ResolveStatesEnum> {
    return new Promise((resolve, reject) => {
      try {
        switch (event.header.action) {
          case ActionsEnum.open:
            proxySelector
              .addHost(connection, event.payload)
              .then(() => {
                resolve(ResolveStatesEnum.VALID);
              })
              .catch((err) => {
                reject(err);
              });
            break;
          case ActionsEnum.close:
            connection.close(Connection.CLOSE_REASON_NORMAL, `NORMAL CLOSE`);
            resolve(ResolveStatesEnum.VALID);
            break;
          default:
            resolve(ResolveStatesEnum.INVALID);
            break;
        }
      } catch (err) {
        reject(err);
      }
    });
  }
  abstract resolvePersonalizedMsg(
    connection: Connection,
    proxySelector: ProxySelector,
    event: InteliEvent<TypesEnum, ActionsEnum, any, any>
  ): Promise<ResolveStatesEnum>;
}
export class DefaultProxyMsgHandler extends ProxyMsgHandler {
  resolvePersonalizedMsg(
    connection: Connection,
    proxySelector: ProxySelector,
    event: InteliEvent<TypesEnum, ActionsEnum, any, any>
  ): Promise<ResolveStatesEnum> {
    return new Promise((resolve, rejects) => {
      resolve(ResolveStatesEnum.INVALID);
    });
  }
}
