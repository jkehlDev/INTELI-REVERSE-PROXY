import { createLogger, Logger, format, transports } from 'winston';

const { combine, timestamp, label, colorize, uncolorize, printf } = format;
const defaultFormat = printf(({ level, message, label, timestamp }) => {
  return `[${timestamp}, ${level}, ${label}] ${message}`;
});

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
      new transports.File({ filename: 'syserr.log', level: 'error' }),
      new transports.File({ filename: 'sysout.log' }),
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
