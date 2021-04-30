// <== Imports externals modules
import { createLogger, Logger, format, transports } from 'winston';
// ==>
const { combine, timestamp, label, colorize, uncolorize, printf } = format;
const defaultFormat = printf(({ level, message, label, timestamp }) => {
  return `[${timestamp}, ${level}, ${label}] ${message}`;
});

const sysoutFileName: string = process.env.PROXY_LOGGER_SYSOUT || 'sysOut.log';
const syserrFileName: string = process.env.PROXY_LOGGER_SYSERR || 'sysErr.log';

function getLogger(origin: string): Logger {
  const logger = createLogger({
    level: 'info',
    format: combine(
      timestamp(),
      label({ label: origin }),
      uncolorize(),
      defaultFormat
    ),
    transports: [
      new transports.File({
        filename: `${process.cwd()}/${syserrFileName}`,
        level: 'error',
      }),
      new transports.File({ filename: `${process.cwd()}/${sysoutFileName}` }),
    ],
  });
  if (process.env.NODE_ENV !== 'production') {
    logger.add(
      new transports.Console({
        format: combine(
          timestamp(),
          label({ label: origin }),
          colorize(),
          defaultFormat
        ),
      })
    );
  }
  return logger;
}

export default getLogger;
