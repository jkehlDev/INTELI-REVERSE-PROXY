import Authentification from "./proxyEvent/Authentification";
import Header from "./proxyEvent/Header";
import Payload from "./proxyEvent/Payload";

interface EventFrame {
  header: Header;
  authentification: Authentification;
  payload: Payload;  
}

export default EventFrame;
