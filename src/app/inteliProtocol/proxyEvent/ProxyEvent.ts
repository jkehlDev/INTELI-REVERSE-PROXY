import InteliEvent from '../InteliEvent';
import TypeEnum from './ProxyEventTypes';
import ActionEnum from './ProxyEventActions';
import AuthJwt from '../Authentification/AuthJwt';
import Host from './Host';

interface ProxyEvent extends InteliEvent<TypeEnum, ActionEnum, AuthJwt, Host> {}

export default ProxyEvent;
