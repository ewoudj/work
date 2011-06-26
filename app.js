var proxyTamper = require('./lib/proxy-tamper');
var control = require('./../control/lib/control').control;
var formidable = require('formidable');
var nodestatic = require('node-static');

var proxyPort = 30972;
var allRegex = /.*/;
var domainRegEx = /:\/\/(.[^\/]+)/;

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
				if(request.method === 'POST'){
					var form = new formidable.IncomingForm();
					request.handled = true;
					form.parse(request.innerRequest, function(err, fields, files) {
						request.response.writeHead(200, {'content-type': 'text/plain'});
						request.response.write('received upload:\n\n');
						request.response.end();
					});
				}
				else {
					if(request.url.indexOf('/resources')===0){
						request.handled = true;
						fileServer.serve(request.innerRequest, request.response);
					}
					else{
						request.response.writeHead(200, {});
						request.response.write(renderInterface(request), 'utf8');
						request.response.end();
						request.handled = true;
					}
				}
			}
		}
	});
});

var createInputControls = function(title, value, postMethod){
	return {
		tag: 'form',
		attributes:{ 
			action: 'http://localhost:' + proxyPort + '/index.html?method=' + postMethod,
			method: 'post'
		},
		items: [
		    {tag: 'h2', controlValue: title},
	        {tag: 'textarea', controlValue: value, attributes:{name: 'value'}}, 
		    {tag: 'input', attributes:{type: 'submit', value: 'Submit'}}
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

var getRandomMotivation = function(){
	var result = 'Just get back to work!';
	if(randomMotivation){
		var parts = randomMotivation.split('\n');
		result = parts[Math.floor(Math.random()*parts.length)];
	}
	return result;
};

var renderInterface = function(request){
	
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
			tag: 'body',
			items:[{
				tag: 'h1', controlValue: 'BACK TO WORK!'
			},{
				tag: 'p', controlValue: getRandomMotivation()
			},{
				tag: 'h2', controlValue: 'Current task:'
			},{
				tag: 'p', controlValue: currentTask ? currentTask.title : 'No current task selected'
			},
			createInputControls('All tasks:', taskItems, 'setTasks'),
			createInputControls('Random Motivation:', randomMotivation, 'setExemptDomains'),
			createInputControls('Exempt domains:', 'test', 'setExemptDomains'),
			createInputControls('Recently refused domains:', 'test')]
		}]
	});
	return c.render();
};

console.log('Started proxy at localhost:' + proxyPort);