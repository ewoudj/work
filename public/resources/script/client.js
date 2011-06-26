var postData = function(url, data, callback){
	var http = new XMLHttpRequest();
	var params = 'value=' + data;
	http.open('POST', url, true);
	http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	http.setRequestHeader("Content-length", params.length);
	http.setRequestHeader("Connection", "close");
	http.onreadystatechange = function() {
		if(http.readyState == 4 && http.status == 200) {
			callback(http.responseText);
		}
	};
	http.send(params);
};

var controlsLastValue = {};
var controls = {};

var watchControl = function(control){
	controlsLastValue[control.name] = control.value;
	controls[control.name] = control;
};

setInterval( function(){
	for(var name in controls){
		if(controls[name].value !== controlsLastValue[name]){
			controlsLastValue[name] = controls[name].value;
			alert('change ' + name);
		}
	}
}, 1000);