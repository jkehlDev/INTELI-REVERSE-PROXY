import jwt from 'jsonwebtoken';
import { request } from 'websocket';
import RedisClient from '../db/redisClient';

class AuthHandler {
  private static TOKEN_REDIS_PREFIX: string = 'TOKENBLKLST';
  private static AUTH_REDIS_PREFIX: string = 'USERONLINE';
  private static TOKEN_DURATION: number =
    parseInt(process.env.TOKEN_DURATION, 10) || 1000;
  private static USER_ONLINE_DURATION: number =
    parseInt(process.env.USER_ONLINE_DURATION, 10) || 86400;

  private redisClient: RedisClient = new RedisClient();

  verify(request: request): boolean {
    const authHeader = request.httpRequest.headers.authorization;
    if (!authHeader) {
      return false;
    }
    const token = authHeader.split(' ')[1];
    this.redisClient
      .has(token, AuthHandler.TOKEN_REDIS_PREFIX) // CHECK IF TOKEN IS BLACK LISTED
      .then((has) => {
        if (has) {
          return false;
        } else {
          jwt.verify(
            token,
            process.env.TOKEN_SECRET,
            async (error: Error, decoded: any) => {
              if (error) {
                throw error;
              } else {
                try {
                  await this.redisClient // ADD USED TOKEN INTO BLACK LIST FOR HIS LIFE DURATION
                    .set(
                      AuthHandler.TOKEN_DURATION,
                      'token',
                      token,
                      AuthHandler.TOKEN_REDIS_PREFIX
                    );
                  return true;
                } catch (error_1) {
                  throw error_1;
                }
              }
            }
          ); // IF Not black listed process check validity
        }
      })
      .catch((error) => {
        throw error;
      });
  }

  refreshAuthentification(userId) {
    try {
      if (userId) {
        this.redisClient
          .has(userId, AuthHandler.AUTH_REDIS_PREFIX) //check if user is tagged online
          .then((has) => {
            if (has) {
              return jwt.sign({ id: userId }, process.env.TOKEN_SECRET, {
                expiresIn: AuthHandler.TOKEN_DURATION,
              }); // In case of user online, generate a new jwt
            }
          })
          .catch((error1) => {
            throw error1;
          });
      }
    } catch (error) {
      throw error;
    }
  }

  setUserOnLine(userId: string) {
    const putUser = (userId: string): Promise<boolean> =>
      this.redisClient.set(
        AuthHandler.USER_ONLINE_DURATION,
        userId,
        userId,
        AuthHandler.AUTH_REDIS_PREFIX
      );

    const delUser = (userId: string): Promise<boolean> =>
      this.redisClient.delete(userId, AuthHandler.AUTH_REDIS_PREFIX);

    try {
      this.redisClient
        .has(userId, AuthHandler.AUTH_REDIS_PREFIX) // Check if user is already online state
        .then((has) => {
          return has
            ? delUser(userId).then(() => putUser(userId)) // If user is already online refresh timed entry
            : putUser(userId); // If user is not already online set a new timed entry
        })
        .catch((error) => {
          throw error;
        });
    } catch (error) {
      throw error;
    }
  }

  setUserOffLine(_, response, next) {
    try {
      this.redisClient
        .delete(response.locals.userId, AuthHandler.AUTH_REDIS_PREFIX)
        .catch((error) => {
          throw error;
        });
    } catch (error) {
      next(error);
      return;
    }
    next();
  }
}

module.exports = AuthHandler;
