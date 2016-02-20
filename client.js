var _ = require('lodash');
var moment = require('moment');
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
};