import ProxyEvent from './proxyEvent/ProxyEvent';
import ActionEnum from './EventActions';
import TypeEnum from './EventTypes';

class EventFactory {
  static makeProxyEvent(
    action: ActionEnum.open | ActionEnum.close,
    token: string,
    host: string,
    port: number
  ): Readonly<ProxyEvent> {
    return {
      header: { type: TypeEnum.proxy, action },
      authentification: { token },
      payload: { host, port },
    };
  }
}

export default EventFactory;
