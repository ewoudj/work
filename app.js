var proxyTamper = require('./lib/proxy-tamper');
var control = require('./../control/lib/control').control;
var formidable = require('formidable');
var nodestatic = require('node-static');
var sanitizer = require('sanitizer');

var proxyPort = 30972;
var allRegex = /.*/;
var domainRegEx = /:\/\/(.[^\/]+)/;
var userConfig = null;

var getConfig = function(callback){
	if(!userConfig){
		userConfig = getDefaultConfig();
	}
	callback(userConfig);
};

var getDefaultConfig = function(){
	return {
		tasks: 'Implement Back to Work app\nImplement taks list functionality\nRefactor framework functionality',
		motivation: "There might be class mates more successfull than you.\nJames told you it could not be done.\nDo not let the BMW drivers win!",
		exemptDomains: 'google.nl\ngoogle.com\nstackoverflow.com'
	};
};

var setConfig = function(newConfig, callback){
	callback(newConfig);
};

var exemptDomains = {
	'google.nl': true,
	'google.com': true,
	'stackoverflow.com': true,
	'geenstijl.nl': true
};

var tasks =[{
	title: 'Implement Back to Work app'
},{
	title: 'Implement taks list functionality'
}, {
	title: 'Refactor framework functionality',
	current: true
}];

var randomMotivation = "There might be class mates more successfull than you.\nJames told you it could not be done.\nDo not let the BMW drivers win!";

var fileServer = new nodestatic.Server('./public');

var proxy = require('./lib/proxy-tamper').start({ port: proxyPort }, function(p){
	p.tamper(/.*/, function (request) {
		if(request && request.url){
			var isExempt = false;
			if(request.url.indexOf('/')!==0){
				var domainName = domainNameFromUrl(request.url);
				console.log(domainName);
				isExempt = exemptDomains[domainName];
			}
			if(!isExempt){
				request.handled = true;
				if(request.method === 'POST'){
					// User changing the config
					var form = new formidable.IncomingForm();
					form.parse(request.innerRequest, function(err, fields, files) {
						var property = request.url.substr(1);
						getConfig(function(config){
							config[property] = fields.value;
							setConfig(config, function(setResult){
								request.response.writeHead(200, {'content-type': 'text/plain'});
								request.response.write(config[property]);
								request.response.end();
							});
						});
					});
				}
				else {
					if(request.url.indexOf('/resources')===0){
						// Request for static file
						fileServer.serve(request.innerRequest, request.response);
					}
					else{
						// Render the user interface
						getConfig(function(config){
							request.response.writeHead(200, {});
							request.response.write(renderInterface(request, config), 'utf8');
							request.response.end();
						});
					}
				}
			}
		}
	});
});

var createInputControls = function(title, value, id){
	return {
		items: [
		    {tag: 'h2', controlValue: title},
	        {tag: 'textarea', controlValue: value, attributes:{id: id,name: 'value'}}, 
	    ]
	};
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
	var taskItems = "";
	var currentTask = null;
	for(var i = 0; i < tasks.length ; i++){
		if(taskItems){
			taskItems = taskItems + '\n';
		}
		taskItems = taskItems + tasks[i].title;
	}
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
			items:[
				{tag: 'h1', controlValue: 'BACK TO WORK!'},
				{tag: 'p', controlValue: sanitizer.escape(getRandomMotivation(config))},
				{tag: 'h2', controlValue: 'Current task:'},
				{tag: 'p', controlValue: sanitizer.escape(getCurrentTask(config)), attributes: {id: 'currentTask'}},
				createInputControls('All tasks:', config.tasks, 'tasks'),
				createInputControls('Random Motivation:', config.motivation, 'motivation'),
				createInputControls('Exempt domains:', config.exemptDomains, 'exemptDomains'),
				createInputControls('Recently refused domains:', 'test', 'refusedDomains')]
		}]
	});
	return c.render();
};

console.log('Started proxy at localhost:' + proxyPort);