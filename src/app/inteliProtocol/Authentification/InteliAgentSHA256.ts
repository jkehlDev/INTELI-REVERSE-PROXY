import {
  createSign,
  createVerify,
  generateKeyPairSync,
  Signer,
  Verify,
} from 'crypto';
import fs from 'fs';
import getLogger from 'app/tools/logger';
// LOGGER INSTANCE
const logger = getLogger('InteliSHA256Factory');

// TIPS https://nodejs.org/api/crypto.html#crypto_class_sign

export default interface InteliAgentSHA256 {
  agentId?: string | 'sysadmin';
  signature?: string;
}

export class InteliSHA256Factory {
  public static genKeys(agentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Generate private and public pair keys
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      // Write private key
      fs.writeFile(
        `${process.cwd()}/${agentId}_privateKey.pem`,
        privateKey,
        (err) => {
          if (err) reject(err);
          // Write public key
          fs.writeFile(
            `${process.cwd()}/${agentId}_publicKey.pem`,
            publicKey,
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        }
      );
    });
  }

  public static makeInteliAgentSHA256(agentId: string): InteliAgentSHA256 {
    if (!fs.existsSync(`${process.cwd()}/${agentId}_privateKey.pem`)) {
      logger.error(
        `Agent RSA private key not found at ${process.cwd()}/${agentId}_privateKey.pem`
      );
      throw new Error(
        `ERROR - [${new Date()}] Agent RSA private key not found at ${process.cwd()}/${agentId}_privateKey.pem`
      );
    }

    // Sign agentId with private key
    const cryptoSign: Signer = createSign('SHA256');
    cryptoSign.write(agentId);
    cryptoSign.end();

    // Read private key
    const privateKey: Buffer = fs.readFileSync(
      `${process.cwd()}/${agentId}_privateKey.pem`
    );

    // Make InteliSHA256
    return {
      agentId,
      signature: cryptoSign.sign(privateKey, 'hex'),
    };
  }
}

export function inteliSHA256CheckValidity(
  inteliSHA256: InteliAgentSHA256
): boolean {
  if (
    !fs.existsSync(
      `${process.cwd()}/certstore/${inteliSHA256.agentId}_publicKey.pem`
    )
  ) {
    logger.error(
      `Agent RSA public key not found at ${process.cwd()}/certstore/${
        inteliSHA256.agentId
      }_publicKey.pem`
    );
    throw new Error(
      `ERROR - [${new Date()}] Agent RSA public key not found at ${process.cwd()}/certstore/${
        inteliSHA256.agentId
      }_publicKey.pem`
    );
  }

  // Making signature verifier
  const cryptoVerify: Verify = createVerify('SHA256');
  cryptoVerify.write(inteliSHA256.agentId);
  cryptoVerify.end();

  // Read public key
  const publicKey: Buffer = fs.readFileSync(
    `${process.cwd()}/certstore/${inteliSHA256.agentId}_publicKey.pem`
  );

  return cryptoVerify.verify(publicKey, inteliSHA256.signature, 'hex');
}

export function inteliSHA256CheckAuthorizationHeader(authorization: string) {
  if (authorization.includes('INTELI-SHA256')) {
    let inteliSHA256: InteliAgentSHA256 = {};
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
    return inteliSHA256CheckValidity(inteliSHA256);
  }
  return false;
}
