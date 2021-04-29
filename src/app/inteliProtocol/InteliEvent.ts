import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import TypeEnum from 'app/inteliProtocol/enums/EventTypes';

interface InteliEvent<
  Type extends TypeEnum | string,
  Action extends ActionEnum | string,
  Auth,
  Payload
> {
  header: {
    type: Type;
    action: Action;
  };
  authentification: Auth;
  payload: Payload;
}

export default InteliEvent;
