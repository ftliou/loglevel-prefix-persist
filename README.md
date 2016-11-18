# loglevel-prefix-persist
[loglevel](http://github.com/pimterry/loglevel) plugin - Support for the following:

* (Almost) Isomorphic - passes single log config that can be used on both client and server
* can be used by client or server alone
* client & server log message prefix with [your/module-name] 
* client & server log persistence
* additional datetime information, text color to server log

Uses 
* [file-stream-rotator](http://github.com/ftliou/file-stream-rotator) to rotate logs daily
* [node-schedule](http://github.com/node-schedule/node-schedule) to clean up files over configured maximum number of log files


#Usage 
Assuming the following simple config
```javascript
var logCfg = {
    "level":{
        "production": "warn",
        "development": "info"
    },
    "persist":"error",
    "max":2
}
```

On server side, initialize plugin in server.js
```javascript

var loglevel = require('loglevel');
var logger = require('loglevel-prefix-persist/server')
var log = logger(process.env.NODE_ENV, loglevel, logCfg);


var app = express();
app
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json())

//...

if (log.writer) {
	// if client log persistence is enabled, this will accept and writes logs coming from client side
    app.use(log.writer);
}


```

On client side, initialize plugin in client.js entry
```javascript
var loglevel = require('loglevel');
var logger = require('loglevel-prefix-persist/client');
var log = logger('development', loglevel, logCfg);

```


All together (for both client and server)
```javascript

// namespacing modules
var log = require('loglevel').getLogger("my/module-name");

// start logging
log.debug('Debug will not show')
log.info('Info will show under development, but not in production','config',logCfg)
log.warn('Warn will always show')
log.error('Error will always show')
```
#Result
server

![alt server](https://cloud.githubusercontent.com/assets/5211544/20420010/57eb5c6c-ad95-11e6-8d00-f5ba7c38e937.png)

client

![alt client](https://cloud.githubusercontent.com/assets/5211544/20420012/5c2b15b0-ad95-11e6-8a31-a346915f971c.png)

#Config
* Default environment is 'development'
* Default log level is 'info'
* Default persistence for server is same as log level
* Default persistence for client is disabled
* If persistence is turned on and max is not set, old files will not be cleaned up

Config examples:
```javascript

// log level='warn', server persistence only (at 'warn'), log daily forever
var logCfg = {
	"level":"warn"
}

// log level for client+server, no persistence
var logCfg = {
	"level": {"server":"info", "client":"warn"}, // regardless of environment
	"persist":false
}

// log level for production+development, persist for level='error', max 2 days log
var logCfg = {
    "level":{
        "production": "warn",
        "development": "info"
    },
    "persist":"error",
    "max":2
}

// cfg for production+developement, client+server
var logCfg = {
    "level":{
        "production": {"server":"info", "client":"warn"},
        "development": "debug"
    },
    "persist":{
        "client":"error", // only persist client level='error'
        "server":true // persist server 'debug' in development, 'info' in production
    },
    "max":2
}


```