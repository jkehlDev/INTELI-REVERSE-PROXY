import WebServerEvent from 'app/inteliProtocol/webServerEvent/WebServerEvent';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import TypeEnum from 'app/inteliProtocol/enums/EventTypes';
import InteliAgentSHA256 from './Authentification/InteliAgentSHA256';
import SysAdminEvent from './sysAdminEvent/SysAdminEvent';

class EventFactory {
  static makeWebServerEvent(
    action: ActionEnum.open | ActionEnum.close,
    InteliAgentSHA256: InteliAgentSHA256,
    version: string,
    host: string,
    port: number
  ): Readonly<WebServerEvent> {
    return {
      header: { type: TypeEnum.webServer, action },
      authentification: InteliAgentSHA256,
      payload: { hostId: InteliAgentSHA256.agentId, version, host, port },
    };
  }
  static makeSysAdminEvent(
    action: ActionEnum.add | ActionEnum.remove,
    signature: string,
    hostId: string,
    publicKey: string
  ): Readonly<SysAdminEvent> {
    return {
      header: { type: TypeEnum.sysadmin, action },
      authentification: { agentId: 'sysadmin', signature },
      payload: { hostId, publicKey },
    };
  }
}

export default EventFactory;
