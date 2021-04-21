import Authentification from "./proxyEvent/Authentification";
import Header from "./proxyEvent/Header";
import Host from "./proxyEvent/Host";

interface ProxyEvent {
  header: Header;
  authentification: Authentification;
  payload: Host;  
}

export default ProxyEvent;
