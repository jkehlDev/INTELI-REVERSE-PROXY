import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.label({label : `filename`}),
    format.colorize(),
    ),
    
    transports: [
      new transports.File({ filename: 'error.log', level: 'error' }),
      new transports.File({ filename: 'combined.log' }),
    ],
  });
  
  const myMessage = format.printf(({ timestamp, level, label, message}) => {
    return `${timestamp} ${level}: [${label}] ${message}`;
  });
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
        format: myMessage,
    })
  )
}

export default logger;
