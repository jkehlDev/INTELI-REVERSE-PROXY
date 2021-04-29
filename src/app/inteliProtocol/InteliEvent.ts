// <== Imports externals modules
import ActionsEnum from './enums/ActionsEnum';
import TypesEnum from './enums/TypesEnum';
// ==>
interface InteliEvent<
  Type extends TypesEnum | string,
  Action extends ActionsEnum | string,
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
