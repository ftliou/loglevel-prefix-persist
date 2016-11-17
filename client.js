var _ = require('lodash');
var moment = require('moment');
var fetch = require('whatwg-fetch');
var utils = require('./lib/utils');

module.exports = function(env, logger, config) {

    var originalFactory = logger.methodFactory;
    if (!env) {
        env ="development";
    }
    if (!config) {
        config = {};
    }

    var level = utils.getLogLevel(env, config, false);
    var persist = utils.getPersistence(config, false, level);

            
    logger.methodFactory = function (methodName, logLevel, loggerName) {
        var rawMethod = originalFactory(methodName, logLevel, loggerName);
        
        if (persist && logger.levels[methodName.toUpperCase()] >= logger.levels[persist.toUpperCase()]) {
            return function () {
                fetch('/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type:methodName, module:loggerName+"::client", args:_.values(arguments)
                    })
                })
                rawMethod.apply(null, ["["+loggerName + "]"].concat(_.values(arguments)));
            };
        }
        else {
            return rawMethod.bind(null, loggerName ? "["+loggerName+ "] "  : '');
        }
    };
    logger.setLevel(level);
    
    module.exports = logger;
    return logger;
};