import InteliAgentSHA256 from './Authentification/InteliAgentSHA256';

interface InteliEvent<Type extends string, Action extends string, Payload> {
  header: {
    type: Type;
    action: Action;
  };
  authentification: InteliAgentSHA256;
  payload: Payload;
}

export default InteliEvent;

export const INTELI_PROTOCOL: string = 'inteli-protocol-v1.00';
