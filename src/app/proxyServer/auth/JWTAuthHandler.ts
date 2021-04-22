import jwt from 'jsonwebtoken';
import RedisClient from '../db/redisClient';

export enum AuthResults {
  accepted,
  refused,
  expired,
}

interface AuthPayload {
  clientId: string;
}
function authPayloadFactory(clientId: string): AuthPayload {
  return { clientId };
}

/**
 * @class This class provide authentification JWT handler for Inteli Reverse Proxy server instance
 * @version 1.00
 */
export class JWTAuthHandler {
  private static TOKEN_REDIS_PREFIX: string = 'TOKENBLKLST';
  private static AUTH_REDIS_PREFIX: string = 'USERONLINE';
  private static TOKEN_DURATION: number =
    parseInt(process.env.TOKEN_DURATION, 10) || 1000;
  private static USER_ONLINE_DURATION: number =
    parseInt(process.env.USER_ONLINE_DURATION, 10) || 86400;

  private static redisClient: RedisClient = new RedisClient();

  public static async verify(token: string): Promise<AuthResults> {
    try {
      const isBlacked: boolean = await this.isBlackListedToken(token);
      if (isBlacked) {
        return AuthResults.refused;
      }
      await this.addTokenToBlackList(token);
      return this.getAuthResult(token);
    } catch (error) {
      return AuthResults.refused;
    }
  }

  private static async getAuthResult(token: string): Promise<AuthResults> {
    return new Promise<AuthResults>((resolve, _) => {
      jwt.verify(
        token,
        process.env.TOKEN_SECRET,
        async (err, payload: AuthPayload) => {
          if (err.name === 'TokenExpiredError') {
            resolve(AuthResults.expired);
          }
          if (err === null) {
            if (await this.isClientOnline(payload.clientId)) {
              resolve(AuthResults.accepted);
            } else {
              resolve(AuthResults.refused);
            }
          } else {
            resolve(AuthResults.refused);
          }
        }
      );
    });
  }

  public static async genToken(clientId: string): Promise<string> {
    try {
      if (clientId) {
        if (await this.isClientOnline(clientId)) {
          return jwt.sign(
            authPayloadFactory(clientId),
            process.env.TOKEN_SECRET,
            {
              expiresIn: JWTAuthHandler.TOKEN_DURATION,
            }
          );
        }
      }
    } catch (error) {
      throw error;
    }
    throw new Error(`Can't generate token, client offline`);
  }

  private static async isBlackListedToken(token: string): Promise<boolean> {
    try {
      return this.redisClient.has(token, JWTAuthHandler.TOKEN_REDIS_PREFIX);
    } catch (error) {
      throw error;
    }
  }

  private static async addTokenToBlackList(token: string): Promise<void> {
    try {
      await this.redisClient // ADD USED TOKEN INTO BLACK LIST FOR HIS LIFE DURATION
        .set(
          JWTAuthHandler.TOKEN_DURATION,
          'token',
          token,
          JWTAuthHandler.TOKEN_REDIS_PREFIX
        );
    } catch (error) {
      throw error;
    }
  }

  private static async isClientOnline(clientId: string): Promise<boolean> {
    try {
      return this.redisClient.has(clientId, JWTAuthHandler.AUTH_REDIS_PREFIX);
    } catch (error) {
      throw error;
    }
  }

  public static async setClientOnLine(clientId: string): Promise<void> {
    try {
      if (this.isClientOnline(clientId)) {
        await this.setClientOffLine(clientId);
      }
      await this.redisClient.set(
        JWTAuthHandler.USER_ONLINE_DURATION,
        clientId,
        clientId,
        JWTAuthHandler.AUTH_REDIS_PREFIX
      );
    } catch (error) {
      throw error;
    }
  }

  public static async setClientOffLine(clientId): Promise<void> {
    try {
      await this.redisClient.delete(clientId, JWTAuthHandler.AUTH_REDIS_PREFIX);
    } catch (error) {
      throw error;
    }
  }
}
