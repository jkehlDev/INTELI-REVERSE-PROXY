import ActionEnum from 'app/inteliProtocol/EventActions';
import TypeEnum from 'app/inteliProtocol/EventTypes';

interface InteliEvent<
  Type extends TypeEnum,
  Action extends ActionEnum,
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
