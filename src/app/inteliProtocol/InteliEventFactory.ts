import WebServerEvent from 'app/inteliProtocol/webServerEvent/WebServerEvent';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import TypeEnum from 'app/inteliProtocol/enums/EventTypes';
import InteliAgentSHA256 from './Authentification/InteliAgentSHA256';
import SysAdminEvent from './sysAdminEvent/SysAdminEvent';
import InteliEvent from './InteliEvent';
import TargetCert from './sysAdminEvent/TargetCert';

class EventFactory {
  static makeInteliEvent(
    type: string,
    action: string,
    inteliAgentSHA256: InteliAgentSHA256,
    payload: any
  ): Readonly<InteliEvent<string, string, InteliAgentSHA256, any>> {
    return {
      header: { type, action },
      authentification: inteliAgentSHA256,
      payload,
    };
  }
  static makeWebServerEvent(
    action: ActionEnum.open | ActionEnum.close,
    inteliAgentSHA256: InteliAgentSHA256,
    version: string,
    host: string,
    port: number,
    rule: string = '/'
  ): Readonly<WebServerEvent> {
    return {
      header: { type: TypeEnum.webServer, action },
      authentification: inteliAgentSHA256,
      payload: {
        hostId: inteliAgentSHA256.agentId,
        version,
        rule,
        target: {
          host,
          port,
        },
      },
    };
  }
  static makeSysAdminEvent(
    action: ActionEnum.add | ActionEnum.remove,
    inteliAgentSHA256: InteliAgentSHA256,
    payload: TargetCert
  ): Readonly<SysAdminEvent> {
    return {
      header: { type: TypeEnum.sysadmin, action },
      authentification: inteliAgentSHA256,
      payload,
    };
  }
}

export default EventFactory;
