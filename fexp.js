var folders = [{
		display : '專案跌',
		path : 'd:\\tools'
	},
    {
		display:'photos',
		path:'d:\\nodejs\\fexp\\public'
	}
]

var fail_over='/browse'

var _=require('lodash')

var io=require('socket.io')

var url=require('url')
var fs=require('fs')
var path=require('path')

var express=require('express')
app=express()

function path2url(path) {
	path=path.replace(':','')
	return path.replace(/\\/g,'/')
}

app.get('/browse', function(req,res){
	var ar=[]
	folders.map(function(x){
		ar.push('<a href="'+path2url(x.path)+'">'+x.display+'</a>')		
	})
	res.send(ar.join('<br>'))
})

app.set('view engine', 'jade');

var busboy = require('connect-busboy');
app.use(busboy());

var bodyParser=require('body-parser');
app.use(bodyParser.urlencoded({
	extended: true, limit:1024*1024*100,  parameterLimit: 50000
}));

app.use(bodyParser.json({
	extended: true, limit:1024*1024*100,  parameterLimit: 50000
}));

var morgan  = require('morgan')
app.use(morgan('dev'))

var errorHandler=require('errorhandler')
var path=require('path')

var env = process.env.NODE_ENV || 'development';
if ( ( 'development' == env ) | true ) {
	app.use(errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
}
else {
	app.use(errorHandler())
}

app.get('/execute/*', get_parent_path, function(req,res){
	var exec = require('child_process').exec;
	var cmd = req.target_path;

	exec(cmd, function(error, stdout, stderr) {
  		// command output is in stdout
  		res.send({
  			stdout:stdout,
  			err:error,
  			stderr:stderr
  		})
	});
})

app.get('/delete/*', get_parent_path, function(req,res){
	fs.unlink(req.target_path, function(err){
		if (err) res.send(err)
		else {
			debug('go path',parent)
			res.redirect(req.parent_path)
		}
	})
})

function get_parent_path(req,res,next){
	var path='/'+req.params[0]	
	var del_target=get_url_path(path)

	var xparent=path.split('/')
	debug('xparent',xparent)
	xparent.splice(-1,1)
	debug('xparent',xparent)
	var parent=xparent.join('/')
	
	req.target_path=del_target
	req.parent_path=parent
	next()
}

app.get('/terminate',function(req,res){	
	setTimeout(function(){
		process.exit(-1)
	},1000)
	res.redirect(fail_over)
})

app.get('/public/:file',function(req,res){
	res.sendfile(path.join(__dirname,'public',req.params.file))
})

app.get('/file_image/:file_name', function(req,res){
	function ret_file(s) {
		var ss=path.join(__dirname,'public',s)
		console.log('ss',ss)
		res.sendfile(ss)
	}

	var fname=req.params.file_name
	console.log('fname',fname)	

	if (fname.indexOf('.')==-1) return ret_file('file.gif')
	
	var ext=fname.split('.').splice(-1,1)[0].toLowerCase()	
	console.log(req.params.file_name+'===>'+ext)		
	var icon=path.join(__dirname,'public','icon_'+ext+'.gif')

	fs.stat(icon, function(err,stat){
		if (!err) return res.sendfile(icon)
		switch (ext) {
			case 'png':
				ret_file('icon_png.png')
				break;
			case 'bmp':
				ret_file('bmp.png')
				break;
			case 'mkv':
				ret_file('mkv.png')
				break;
			case 'html':
				ret_file('html.jpg')
				break;
			default:
				ret_file('file.gif')
				break;		
		}		
	})		
})

app.get('/:drive', parsing_path, render_items);

app.get('/:drive/*', parsing_path, render_items)

function render_items(req,res){
	console.log('req.path',req.path)

	if (req.query.debug)
		res.send({
			item:req.items,
			item2:req.items2,
		})
	else
		res.render('fexp.jade', {
			items:req.items2,
			base_dir:req.base_dir
		})//send(req.items)
}

function parsing_path(req,res,next){
	var d=req.params.drive+':'
	var p=req.params[0]||'\\'

	console.log(req.params)

	var pp1=path.join(d,p)
	var pp2='d:\\nodejs\\fexp'

	console.log('pp1',pp1)
	console.log('pp2',pp2)
	//req.path=pp1
	//return next()
	//pp='d:\\'
	//req.path=pp
	req.base_dir=req.url

	try {
		var stat=fs.lstatSync(pp1)
	} catch(err) {
		return res.send('fail to open '+pp1)
	}
	
	if (stat.isFile())
		res.sendfile(pp1)
	else
		fs.readdir(pp1, function(err, items) {
			if(err) res.send('access '+pp1+' error',err)
			else {
				req.items=items; 
				req.items2=[]

				items.map(function(s){
					var ss=path.join(pp1,s)
					console.log('s',s,'ss',ss)
					try {
						var stat=fs.lstatSync(ss) 
						stat.dir=stat.isDirectory()
						stat.name=s

						if(!stat.dir) {
							var ext=s.split('.').splice(-1,1)						
							if (ext.length>0)
								stat.exec=['exe','bat'].indexOf(ext[0])>=0
							console.log('exec',s,ext,stat.exec)
						}
						
						
						console.log(stat)
						req.items2.push(stat)					
					}
					catch(err) {
						req.items2.push({
							dir:true,
							name:s
						})
					}
					
					
					// {
					// 	s:s,
					// 	dir:stat.isDirectory(),
					// 	mtime:stat.mtime,
					// 	size:stat.size
					// })
				})

				_.sortBy(req.items2, ['dir','name'], [true, false]);
				
				function compareValue(v1,v2){
					if (v1==v2) return 0
					else if (v1<v2) return -1
					else return 1
				}

				req.items2.sort(function (x, y) {				 	
					var result=compareValue(!x.dir, !y.dir)
				 	return result==0 ? compareValue(x.name.toUpperCase(), y.name.toUpperCase()) : result;
				});

				next()
			}
		})
	//next()
	/*res.send({
		pp:pp,
		param:req.params
	})*/
}

app.post('*', process_upload, function(req,res,next){	
	console.log('req',req.headers)
	var sxfrom=req.headers['referer']//.replace(req.headers['orignal'],'')
	var sfrom=url.parse(sxfrom).pathname 

	return res.redirect(sxfrom)

	console.log('sfrom',sfrom)

	req.params={
		drive:sfrom.split('/')[1],
		0:sfrom.split('/').splice(2).join('/')
	}

	/*res.send({
		sfrom:sfrom,
		parms:req.params
	})*/
	next()
}, parsing_path, render_items)

app.listen(80)

function get_url_path(sfrom) {
	debug('sfrom',sfrom)
	var	drive=sfrom.split('/')[1]+':\\'
	debug('drive',drive)

	var xpath=sfrom.split('/').splice(2).join('/')	
	debug('xpath',xpath)

	return path.join(drive,xpath)
}

function process_upload(req,res,next){	
	//var sfrom=req.path
	var target_folder=get_url_path(req.path)
	debug('ready to copy to ', target_folder)

	req.busboy.on('file', function(fieldname, file, filename) {
		var fs=require('fs')
		var path=require('path')			
		
		console.log('file body==============',req.body)
		//var drive=req.body.target_folder.split('/')[1]+'\\:'
		//var path=req.body.target_folder.split('/').splice(2)

		var tgt=path.join(target_folder, filename)
		//var tgt=path.join(__dirname, 'uploads', filename)
		debug('tgt',tgt)

		fstream=fs.createWriteStream(tgt)
		file.pipe(fstream)
		fstream.on('close',function(){
			req.target_path=tgt
			next();
		})
	});

	req.busboy.on('field', function(fieldname, value, valTruncated, keyTruncated) {
		console.log('<< on:field >>'+fieldname+'==>'+value);
		req.body[fieldname]=value
	});

	req.busboy.once('end', function() {
		console.log('===============\nend body\n==============',req.body)
		console.log('once:end');
		next();
	});

	req.pipe(req.busboy);
}

function debug(s,ss) {
	console.log('================')
	console.log(s)
	console.log('================')
	console.log(JSON.stringify(ss))
}