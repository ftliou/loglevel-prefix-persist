var fs = require('fs');
var chalk = require('chalk');
var async = require('async');
var util = require('util');
var path = require('path');
var scheduler = require('node-schedule');
var fileRotator = require('file-stream-rotator');
var _ = require('lodash');
var moment = require('moment');
var utils = require('./lib/utils');


function formatter (methodName, loggerName, args) {
    var dttm = moment().format('YYYY-MM-DD HH:mm:ss:SSS');
    var prefix = "["+ dttm + " " + methodName.toUpperCase() + (loggerName ? " "+ loggerName : '')+ "]";
    var messages = _.map(args, function(arg) {
        if (typeof arg === 'object') {
            if (arg instanceof Error) {
                return arg.stack;//util.inspect(arg.stack, { showHidden: true, depth: null, colors:true });//JSON.stringify(arg);
            }
            else {
                return util.inspect(arg, { showHidden: false, depth: null });//JSON.stringify(arg);
            }
        }
        else {
            return arg;
        }
    });
    return {prefix:prefix, messages:messages};
}



module.exports = function(env, logger, config) {

    var originalFactory = logger.methodFactory;
    if (!env) {
        env ="development";
    }
    if (!config) {
        config = {};
    }
    config = _.assign({
            path:"", 
            max:null
        }, config);

    var level = utils.getLogLevel(env, config, true);
    var persist = utils.getPersistence(config, true, level);

    if (persist) {

        var rotatingLogStream = fileRotator.getStream({filename:path.join(config.path,"%DATE%.log"), verbose: false, date_format: "YYYY-MM-DD"});

        logger.writeToStream = function(type, module, args) {

            var result = formatter(type, module, args);
            rotatingLogStream.write(result.prefix + " " + result.messages.join(' ')+"\n", 'utf8');
        };

        logger.writer = function(req, res, next) {
            if (req.method === 'POST' && req.url === '/log') {
                logger.writeToStream(req.body.type, req.body.module, JSON.parse(req.body.args));
            }
            next();
        };

        logger.endCritical = function(err, callback) {
            rotatingLogStream.on('finish', function() {
                callback();
            });
            logger.error(err);
            rotatingLogStream.end();
        }
    }


    logger.methodFactory = function (methodName, logLevel, loggerName) {
        var rawMethod = originalFactory(methodName, logLevel, loggerName);

        var ck = {
            error: chalk.red,
            warn: chalk.yellow,
            info: chalk.green,
            debug: chalk.grey,
            trace: chalk.yellow
        };

        return function () {
            var res = formatter(methodName, loggerName, arguments);
            if (persist) {
                logger.writeToStream(methodName, loggerName, arguments);
            }
            rawMethod.apply(null, [(ck[methodName])(res.prefix)].concat(_.map(res.messages, function(msg) {
                return (methodName === 'debug' ? ck[methodName](msg) : msg);
            })));
        };
    };

    logger.setLevel(level);




    var maxLog = config.max || 0;
    if (persist && maxLog > 0) {

        var j = scheduler.scheduleJob('*', function(){
            fs.readdir(config.path, function(err, list) {
                if (!err) {
                    var dated = _.filter(list, function(item) {
                        return /^\d{4}-\d{2}-\d{2}\.log$/.test(item);
                    });
                    if (dated.length > maxLog) {
                        dated.sort();
                        dated = dated.slice(0,dated.length-maxLog);
                        async.each(_.map(dated, function(x) {
                            return config.path+x;
                        }), fs.unlink, function(err) {
                            if (err) {
                                logger.error(err);
                            }
                            else {
                                logger.info('logs deleted', dated);
                            }
                        }); 
                    }
                }
            });
        });
    }

    module.exports = logger;
    return logger;
};
