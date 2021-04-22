import ProxyEvent from './proxyEvent/ProxyEvent';
import ActionEnum from './proxyEvent/ProxyEventActions';
import TypeEnum from './proxyEvent/ProxyEventTypes';

class EventFactory {
  static makeProxyEvent(
    type: TypeEnum,
    action: ActionEnum,
    token: string,
    host: string,
    port: number
  ): ProxyEvent {
    return {
      header: { type, action },
      authentification: { token },
      payload: { host, port },
    };
  }
}

export default EventFactory;
