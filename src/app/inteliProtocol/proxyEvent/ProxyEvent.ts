import InteliEvent from '../InteliEvent';
import TypeEnum from '../EventTypes';
import ActionEnum from '../EventActions';
import AuthJwt from '../Authentification/AuthJwt';
import Host from './Host';

interface ProxyEvent extends InteliEvent<TypeEnum.proxy, ActionEnum.open|ActionEnum.close, AuthJwt, Host> {}

export default ProxyEvent;
