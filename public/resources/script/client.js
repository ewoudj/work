var postData = function(url, data, callback){
	var http = new XMLHttpRequest();
	var params = 'value=' + data;
	http.open('POST', url, true);
	http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	http.setRequestHeader("Content-length", params.length);
	http.setRequestHeader("Connection", "close");
	http.onreadystatechange = function() {
		if(http.readyState == 4 && http.status == 200) {
			if(callback){
				callback(http.responseText);
			}
		}
		if(http.readyState == 4 && http.status != 200) {
			alert('Failed to persist your changes!');
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
			postData('/' + controls[name].id, controls[name].value, function(result){alert(result);});
		}
	}
}, 1000);

var loadHandler = function(){
	watchControl( document.getElementById('tasks') );
};