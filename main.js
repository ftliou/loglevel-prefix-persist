
var _ = require('lodash');
var moment = require('moment');

var DEFAULT_SERVER_LOG_LEVEL = 'info';
var DEFAULT_CLIENT_LOG_LEVEL = 'info';

function isValidLevel(level) {
    return _.isString(level) && /^(trace|debug|info|warn|error)$/i.test(level);
}

function getLogLevel(env, cfg, isServer) {

    var type = isServer ? 'server' : 'client';
    var level = (isServer ? DEFAULT_SERVER_LOG_LEVEL : DEFAULT_CLIENT_LOG_LEVEL); 

    _.some([['level', env || 'development', type], ['level', env || 'development'], ['level']], function(entry) {
        if (_.has(cfg, entry)) {
            var val = _.get(cfg, entry);
            if (isValidLevel(val)) {
                level = val.toLowerCase();
                return true;
            }
        }
    });
    return level;
}


function getPersistence(cfg, isServer, defaultLevel) {

    var type = isServer ? 'server' : 'client';
    var persistLevel = (isServer ? defaultLevel : false); 

    _.some([['persist', type], ['persist']], function(entry) {
        if (_.has(cfg, entry)) {
            var val = _.get(cfg, entry);
            if (_.isBoolean(val)) {
                if (val) {
                    persistLevel = defaultLevel;
                }
                else {
                    persistLevel = false;
                }
                return true;
            }
            if (isValidLevel(val)) {
                persistLevel = val.toLowerCase();
                return true;
            }
        }
    });
    return persistLevel;
}

module.exports = function(env, logger, config) {

    var originalFactory = logger.methodFactory;
    if (!env) {
        env ="development";
    }
    if (!config) {
        config = {};
    }

    if (typeof window !== "undefined") {
        
        var level = getLogLevel(env, config, false);
        var persist = getPersistence(config, false, level);

                
        logger.methodFactory = function (methodName, logLevel, loggerName) {
            var rawMethod = originalFactory(methodName, logLevel, loggerName);
            
            if (persist && logger.levels[methodName.toUpperCase()] >= logger.levels[persist.toUpperCase()]) {
                return function () {
                    $.post('/log', {type:methodName, module:loggerName+"::client", args:JSON.stringify(_.values(arguments))})
                        .done(function() {

                        })
                        .fail(function(xhr) {
                            
                        });
                    rawMethod.apply(null, ["["+loggerName + "]"].concat(_.values(arguments)));
                };
            }
            else {
                return rawMethod.bind(null, loggerName ? "["+loggerName+ "] "  : '');
            }
        };
        logger.setLevel(level);
    }
    else {
        var fs = require('fs');
        var chalk = require('chalk');
        var async = require('async');
        var util = require('util');
        var path = require('path');

        config = _.assign({
                path:"", 
                max:null
            }, config);

        var level = getLogLevel(env, config, true);
        var persist = getPersistence(config, true, level);

        if (persist) {

            var rotatingLogStream = require('file-stream-rotator').getStream({filename:path.join(config.path,"%DATE%.log"), verbose: false, date_format: "YYYY-MM-DD"});

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


        var formatter = function(methodName, loggerName, args) {
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
        };

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

            var j = require('node-schedule').scheduleJob('*', function(){
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

    }

    module.exports = logger;
    return logger;
};
