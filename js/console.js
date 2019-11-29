show_console = 1;
console_limit = 10;
function dump(obj, override = 0, show_type = 1) {
    var out = '';
    
    if (typeof(obj) != 'object') {
    	out = (show_type? `(${typeof(obj)}) ${obj}` : obj) + "</br>";
    } else {
    	out = `${JSON.stringify(obj)}</br>`;
	    /*for (var i in obj) {
	        out += '• (' + typeof(obj[i]) + ') ' + i + ": " + obj[i] + "</br>";
	    }*/
    }
    //alert(out);

    // or, if you wanted to avoid alerts...
    var output = $('#console');
	var elem = $('<div></div>');
	elem.html('>>> '+out);
	elem.append('</br>');
	elem.addClass('last');
	
	for (var el of output.children().slice(0, console_limit*-1)) {
		el.remove();
	}
	
	$('#console div').removeClass('last');
	var oldHeight = output.get(0).scrollHeight;
	var oldTop = output.get(0).scrollTop;
	
    if (override) {
    	output.html(elem);
    } else {
    	output.append(elem);
    }
    
    if (1 || oldHeight == oldTop) {
		output.get(0).scrollTop = output.get(0).scrollHeight;
	}
    return out;
}
function consoleCall(...val) {
	val = val.length == 1? val[0] : val;
	var dumped = dump(val, 0, 0);
}
var newconsole = {
  log: consoleCall,
  warn: consoleCall,
  dir: consoleCall,
  time: consoleCall,
  timeEnd: consoleCall,
  timeLog: consoleCall,
  trace: consoleCall,
  assert: consoleCall,
  clear: consoleCall,
  count: consoleCall,
  countReset: consoleCall,
  group: consoleCall,
  groupEnd: consoleCall,
  table: consoleCall,
  debug: consoleCall,
  info: consoleCall,
  dirxml: consoleCall,
  error: consoleCall,
  groupCollapsed: consoleCall
};
console = Object.assign(console, newconsole);