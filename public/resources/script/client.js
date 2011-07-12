var postData = function(url, data, resultId, callback){
	var http = new XMLHttpRequest();
	var params = 'value=' + data;
	http.open('POST', url, true);
	http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	http.onreadystatechange = function() {
		if(http.readyState == 4 && http.status == 200) {
			if(callback){
				callback(null, resultId, http.responseText);
			}
		}
		if(http.readyState == 4 && http.status != 200) {
			alert('Failed to persist your changes!');
			callback('Failed to persist your changes!', resultId, http.responseText);
		}
	};
	http.send(params);
};

var controlsLastValue = {};
var controls = {};
var handlers = {};

var watchControl = function(control, handler){
	controlsLastValue[control.id] = control.value;
	controls[control.id] = control;
	handlers[control.id] = handler;
};

setInterval( function(){
	for(var name in controls){
		if(controls[name].value !== controlsLastValue[name]){
			controlsLastValue[name] = controls[name].value;
			postData('/' + controls[name].id, controls[name].value, name, function(err, resultId, result){
				if(handlers[resultId]){
					handlers[resultId](result);
				}
			});
		}
	}
}, 1000);

var loadHandler = function(){
	var taskControl = document.getElementById('tasks');
	watchControl( taskControl , function(newValue){
		var currentTaskElement = document.getElementById('currentTask');
		currentTaskElement.innerText = newValue.split('\n')[0];
	});
	watchControl( document.getElementById('motivation') );
	watchControl( document.getElementById('exemptDomains') );
};

var distractionHandler = function(){
	var inputContainer = document.getElementById('inputcontainer');
	var button = document.getElementById('toggleInputButton');
	if(inputContainer.style.display !== 'block'){
		inputContainer.style.display = 'block';
		button.innerText = 'Hide options';
	}
	else{
		inputContainer.style.display = 'none';
		button.innerText = 'Show options';
	}
	
};

var moreDistractionHandler = function(){
	postData('/allowInternet' , 'true', null, function(err, resultId, result){
		if(err){
			alert(err);
		}
		else {
			window.location.reload();
		}
	});
};