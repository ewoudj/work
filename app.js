var proxyTamper = require('./lib/proxy-tamper');
var control = require('./../control/lib/control').control;
var formidable = require('formidable');
var nodestatic = require('node-static');
var sanitizer = require('sanitizer');
var fs = require('fs');

var proxyPort = 30972;
var allRegex = /.*/;
var domainRegEx = /:\/\/(.[^\/]+)/;
var configPath = __dirname + '/user_settings';
var configFilePath = configPath + '/config.js';
var userConfig = null;
var fileServer = new nodestatic.Server('./public');
var refusedDomains = '';
/*
 * From npm/lib/utils/graceful-fs.js
 */
//var timeout = 0;
//
//Object.keys(fs).forEach(function (i) {
//	exports[i] = (typeof fs[i] !== "function") ? fs[i]
//    	: (i.match(/^[A-Z]|^create|Sync$/)) ? function () {
//    		return fs[i].apply(fs, arguments);
//         }
//       : graceful(fs[i]);
//});
//
//function graceful (fn) { return function GRACEFUL () {
//  var args = Array.prototype.slice.call(arguments)
//    , cb_ = args.pop();
//  args.push(cb);
//  function cb (er) {
//    if (er && er.message.match(/^EMFILE, Too many open files/)) {
//      setTimeout(function () {
//        GRACEFUL.apply(fs, args);
//      }, timeout ++);
//      return;
//    }
//    timer = 0;
//    cb_.apply(null, arguments);
//  }
//  fn.apply(fs, args);
//};};

/*
 * Make sure the user settings folder exists
 */
try {
	fs.mkdirSync(configPath, 0755);
}
catch(exception){
	if(exception.errno !== 17 /*EEXIST, the dir already exists*/){
		console.log('\nCould not create the user settings folder because: \n' + exception + '\nStarting anyway...');
	}
}

/*
 * Returns the user config, first tries in memory cache, then filesystem, then default config
 */
var getConfig = function(callback){
	if(!userConfig){
		fs.readFile(configFilePath, function(err, data){
			if(data){
				try{
					userConfig = JSON.parse(data);
				}
				catch(parseException){
					// The data is lost!
				}
			}
			if(!userConfig) {
				userConfig = getDefaultConfig();
			}
			callback( addBehavior( userConfig ));
		});
	}
	else{
		callback(userConfig);
	}
};

/*
 * Return the default user configuration
 */
var getDefaultConfig = function(){
	return {
		tasks: 'Click the "Show options" button below.\n' + 'Add some tasks. (A line per task. First one is current.)',
		motivation: 'Happiness can only be found if you can free yourself of all other distractions. (Saul Bellow)\n' +
					'Work is hard. Distractions are plentiful. And time is short. (Adam Hochchild)\n' +
					'You will encounter many distractions and many temptations to put your goal aside: The security of a job, a wife who wants kids, whatever. But if you hang in there, always following your vision, I have no doubt you will succeed. (Larry Flynt)',
		exemptDomains:	'google.com\n' + 'stackoverflow.com'
	};
};

var allowAllInternetAccess = false;
var allowTimeOut = null;

/*
 * Used to Add behavior to the configuration object after deserialization or instantiation of
 * that configuration object.
 * This behavior can be invoked from the client.
 */
var addBehavior = function(value){
	value.allowInternet = function(){
		allowAllInternetAccess = true;
		if(allowTimeOut){
			clearTimeout(allowTimeOut);
			allowTimeOut = null;
		}
		allowTimeOut = setTimeout(function(){
			allowAllInternetAccess = false;
			allowTimeOut = null;
		}, 30000);
	};
	return value;
};

var setConfig = function(newConfig, callback){
	fs.writeFile(configFilePath, JSON.stringify(userConfig, null, '\t'), function (err) {
		if(err){
			console.log('Unable to write user settings file because: ' + err);
		}
	});
	callback(newConfig);
};

var isDomainExempt = function(url, exemptDomains){
	var result = false;
	if(url.indexOf('/')!==0){
		var domainName = domainNameFromUrl(url);
		result = (exemptDomains.indexOf(domainName) !== -1);
		if(refusedDomains.indexOf(domainName) === -1){
			refusedDomains = (refusedDomains + (refusedDomains ? '\n' : '')) + domainName;
		}
	}
	return result;
};

var proxy = require('./lib/proxy-tamper').start({ port: proxyPort }, function(p){
	p.tamper(/.*/, function (request) {
		if(request && request.url && !allowAllInternetAccess){
			getConfig(function(config){
				if(!isDomainExempt(request.url, config.exemptDomains)){
					handleUnexemptDomain(request, config);
				}
			});
		}
	});
});

var handleUnexemptDomain = function(request, config){
	request.handled = true;
	if(request.method === 'POST'){
		handleFormPost(request, config);
	}
	else {
		handleFormGet(request, config);
	}
};

var textPlain = {'content-type': 'text/plain'};

var handleFormPost = function(request, config){
	// User changing the config
	var form = new formidable.IncomingForm();
	try{
		form.parse(request.innerRequest, function(err, fields, files) {
			if(err){
				write(request, 500, 'Form parser returned an error: ' + err, textPlain);
			}
			else {
				var property = request.url.substr( request.url.lastIndexOf("/") + 1 );
				if(typeof config[property] === 'function'){
					config[property]( fields.value );
					write(request, 200, 'OK', textPlain);
				}
				else {
					config[property] = fields.value;
					setConfig(config, function(setResult){
						write(request, 200, config[property], textPlain);
					});
				}
			}
		});
	}
	catch(formException){
		write(request, 500, 'Parse form failed: ' + formException, textPlain);
	}
};

var write = function(request, code, content, headers, encoding){
	request.response.writeHead(code || 200, headers || {});
	request.response.write(content, encoding);
	request.response.end();
};


var handleFormGet = function(request, config){
	if(request.url.indexOf('/resources')!==-1){
		// Request for static file
		fileServer.serve(request.innerRequest, request.response);
	}
	else{
		// Render the user interface
		write(request, 200, renderInterface(request, config), {}, 'utf8');
	}
};

var createInputControls = function(title, value, id, readonly){
	var result = {
		attributes: {
			"class": 'titleTextArea'
		},
		items: [
		    {tag: 'h2', controlValue: title},
	        {tag: 'textarea', controlValue: value, attributes:{id: id, name: 'value'}}, 
	    ]
	};
	if(readonly){
		result.items[1].attributes.readonly = 'readonly';
	}
	return result;
};

var domainNameFromUrl = function(url){
	var result = url.match(domainRegEx)[1];
	var parts = result.split('.');
	var length = parts.length;
	if(length > 2){
		result = parts[length - 2] + '.' + parts[length - 1];
	}
	return result;
};

var getRandomMotivation = function(config){
	var result = 'Just get back to work!';
	if(config.motivation){
		var parts = config.motivation.split('\n');
		result = parts[Math.floor(Math.random()*parts.length)];
	}
	return result;
};

var getCurrentTask = function(config){
	var result = 'Add some tasks!';
	if(config.tasks){
		var parts = config.tasks.split('\n');
		result = parts[0];
	}
	return result;
};

var renderInterface = function(request, config){
	var c = new control({
		tag: 'html',
		isRootControl: true,
		items: [{
			tag: 'head',
			items: [
			    {tag: 'title', controlValue: 'BACK TO WORK!'},
				{tag: 'script', attributes: {type: 'text/javascript', src: '/resources/script/client.js'}},
				{tag: 'link', voidElement: true, attributes: {rel: 'stylesheet', href: '/resources/css/style.css'}}
			]
		},{
			tag: 'body', attributes:{onload: 'loadHandler()'},
			items: [{attributes:{"class":'maincontainer'}, 
				items:[
					{tag: 'h1', controlValue: 'BACK TO WORK!'},
					{tag: 'p', controlValue: sanitizer.escape(getRandomMotivation(config)), attributes:{"class":'motiviation'}},
					{tag: 'h2', controlValue: 'Current task:', attributes:{"class":'currentTaskLabel'}},
					{tag: 'p', controlValue: sanitizer.escape(getCurrentTask(config)), attributes: {id: 'currentTask', "class": 'currentTask'}},
					{tag: 'p'},
					{tag: 'button', controlValue: 'Show options', attributes:{id: 'toggleInputButton', "class":'distractionButton', onclick: 'distractionHandler()'}},
					{attributes:{"class":'inputcontainer', id : 'inputcontainer'}, items: [
						createInputControls('All tasks:', config.tasks, 'tasks'),
						createInputControls('Random Motivation:', config.motivation, 'motivation'),
						createInputControls('Exempt domains:', config.exemptDomains, 'exemptDomains'),
						createInputControls('Recently refused domains:', refusedDomains, 'refusedDomains', true),
						{tag: 'button', controlValue: 'Allow 30 seconds of internet access', attributes:{id: 'allowInternetButton', "class":'distractionButton', onclick: 'moreDistractionHandler()'}}
					]}
					
				]}
			]
		}]
	});
	return c.render();
};

console.log('\nStarted proxy at localhost:' + proxyPort);