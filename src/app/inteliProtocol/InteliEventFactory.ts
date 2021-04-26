import WebServerEvent from 'app/inteliProtocol/webServerEvent/WebServerEvent';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import TypeEnum from 'app/inteliProtocol/enums/EventTypes';
import InteliSHA256 from './Authentification/InteliSHA256';

class EventFactory {
  static makeWebServerEvent(
    action: ActionEnum.open | ActionEnum.close,
    inteliSHA256: InteliSHA256,
    version: string,
    host: string,
    port: number
  ): Readonly<WebServerEvent> {
    return {
      header: { type: TypeEnum.webServer, action },
      authentification: inteliSHA256,
      payload: { hostId: inteliSHA256.agentId, version, host, port },
    };
  }
}

export default EventFactory;
