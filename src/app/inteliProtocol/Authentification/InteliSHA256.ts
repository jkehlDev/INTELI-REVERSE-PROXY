import {
  createSign,
  createVerify,
  generateKeyPairSync,
  Signer,
  Verify,
} from 'crypto';

import fs from 'fs';

export default interface InteliSHA256 {
  agentId?: string;
  signature?: string;
}

export class InteliSHA256Factory {
  public static genKeys() {
    // Generate private and public pair keys
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Write private key
    fs.writeFile(
      `${process.cwd()}/clientPrivateKey.pem`,
      privateKey,
      function (err) {
        if (err) throw err;
      }
    );

    // Write public key
    fs.writeFile(
      `${process.cwd()}/clientPublicKey.pem`,
      publicKey,
      function (err) {
        if (err) throw err;
      }
    );
  }

  public static makeInteliSHA256(agentId: string, privateKeyFileName: string): InteliSHA256 {
    // Sign agentId with private key
    const cryptoSign: Signer = createSign('SHA256');
    cryptoSign.write(agentId);
    cryptoSign.end();

    // Read private key
    const privateKey: Buffer = fs.readFileSync(
      `${process.cwd()}/${privateKeyFileName}.pem`
    );

    // Make InteliSHA256
    return {
      agentId,
      signature: cryptoSign.sign(privateKey, 'hex'),
    };
  }
}

export function inteliSHA256CheckValidity(
  inteliSHA256: InteliSHA256,
  publicKeyFileName: string
): boolean {
  // Making signature verifier
  const cryptoVerify: Verify = createVerify('SHA256');
  cryptoVerify.write(inteliSHA256.agentId);
  cryptoVerify.end();

  // Read public key
  const publicKey: Buffer = fs.readFileSync(
    `${process.cwd()}/${publicKeyFileName}.pem`
  );

  return cryptoVerify.verify(publicKey, inteliSHA256.signature, 'hex');
}

export function inteliSHA256CheckAuthorizationHeader(
  authorization: string,
  publicKeyFileName: string
) {
  if (authorization.includes('INTELI-SHA256')) {
    let inteliSHA256: InteliSHA256 = {};
    authorization
      .replace('INTELI-SHA256 ', '')
      .split(', ')
      .forEach((entry: string) => {
        const arg: string[] = entry.split('=');
        switch (arg[0]) {
          case 'AgentId':
            inteliSHA256.agentId = arg[1];
          case 'Signature':
            inteliSHA256.signature = arg[1];
        }
      });
    return inteliSHA256CheckValidity(inteliSHA256, publicKeyFileName);
  }
  return false;
}
