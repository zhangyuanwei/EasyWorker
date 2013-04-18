### EasyWorker
Make web worker easy to use.  
让 Web Worker 更易用.  

[例子在这里](http://zhangyuanwei.github.io/EasyWorker/demo.html)

### EasyWorker 是什么
由于js单线程执行的特性，在需要js做大量的运算时，页面会卡死，Web worker提供了一个不错的并行执行的方案，让复杂运算的js可以在新的环境中运行，但是不能支持函数的调用等，只能使用onmessage和postMessage方法来进行主程序和Worker之间的通讯。EasyWorker就是为了解决这样的问题而编写的，它可以实现Worker直接执行函数，并且可以通过回调进行通讯。

### EasyWorker 怎么用
```javascript
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

### console 支持
由于Web Worker作用域中没有console支持,无法方便的调试，所以Web Worker也封装了console的函数，方便在worker中调用。
```javascript
var worker = new EasyWorker();
	worker.setupConsole();  //设置EasyWorker中的console对象
	worker.run(function(){
		console.log("hello world.");
	});
```

### 常见错误
由于浏览器实现不能支持作用域之间的调用，所以在Web Worker中执行的函数只能通过参数的形式与主作用域通讯。  
另外，出了函数外，也不能传递其他不能无法串行化的数据。(EasyWorker 封装了函数的调用和传递)
```javascript
var worker = new EasyWorker(),
	data = "Some data";

	worker.run(function(){
		return data; //不能取到主作用域的数据
	});
	
	worker.run(function(data){
		return data; //可以通过参数的形式进行传递
	}, data);

	worker.run(function(element){
		element.innerHTML = "hello";
	}, document.getElementById("id")); // Element不能通过参数传递
	
	worker.run(function(callback){
		callback("hello");
	}, function(html){
		document.getElementById("id").innerHTML = html; // 可以通过回调的方式来实现
	});
```

### 跨域问题
由于EasyWorker默认使用Blob来创建Web Worker中的代码，所以当在Worker执行的函数中使用AJAX或者importScripts时，会产生跨域问题，您可以通过指定Web worker脚本地址来解决

```javascript
var worker = new EasyWorker();
	worker.run(function(){
		importScripts("somescript.js"); //会产生跨域问题
	});
	
	worker = new EasyWorker("EasyWorker.js"); //指定EasyWorker库地址
	worker.run(function(){
		importScripts("somescript.js"); //这样就不会有问题了
	});
```
