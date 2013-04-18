### EasyWorker
Make web worker easy to use.  
让 Web Worker 更易用.  

例子在这里

```javascript
var worker = new EasyWorker();
worker.run(function(hello){
	hello("World");
}, function(who){
	alert("Hello " + who);
});
```

### EasyWorker 是什么
由于js单线程执行的特性，在需要js做大量的运算时，页面会卡死，Web worker提供了一个不错的并行执行的方案，让复杂运算的js可以在新的环境中运行，但是不能支持函数的调用等，只能使用onmessage和postMessage方法来进行主程序和Worker之间的通讯。EasyWorker就是为了解决这样的问题而编写的，它可以实现Worker直接执行函数，并且可以通过回调进行通讯。

### EasyWorker 怎么用
```
var worker = new EasyWorker(); // 初始化一个EasyWorker

function hello(callback, to){
	callback("Hello " + to);
	return "Done";
}

function say(msg){
	alert(msg);
}

worker.run(hello, say, "world") // 在Worker环境中执行hello函数, 并传入参数
      .done(function(err, ret){ // 设置执行完成后的回调函数
          if(err) throw err;
          alert("return value :" + ret);
      });
```
