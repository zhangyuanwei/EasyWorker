EasyWorker
===========
Make web worker easy to use.

```javascript
var worker = new EasyWorker();
worker.run(function(hello){
	hello("World");
}, function(who){
	alert("Hello " + who);
});
```
