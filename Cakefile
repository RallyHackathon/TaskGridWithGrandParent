fs = require 'fs'
path = require 'path'
rabt = require 'rabt'

option '-u', '--username [username]', 'username to Rally when deploying'
option '-p', '--password [password]', 'password to Rally when deploying'
option '-s', '--server [server]', 'Rally server to deploy to.  Default: rally1'

projectOid = 699319 #FILL ME IN
name = 'Grid2'

task 'compile', 'compile the app', (options) ->
	rabt.compiler.compileFile './build/app.js', './src/app.js'

task 'link', 'link the javascript files together', (options) ->
	invoke 'compile'

	l = new rabt.linker.Linker

	content = l.link './build/app.js'
	fs.writeFileSync './bin/app.js', content

task 'build', 'builds the app.html file', (options) ->
	invoke 'link'

	b = new rabt.builder.Builder
	b.setOption 'appName', name
	j = fs.readFileSync './app.jade'
	content = fs.readFileSync './bin/app.js'

	fs.writeFileSync './bin/app.html', (b.build j, content)

task 'deploy', 'deploy the app to a new tab', (options) ->
	invoke 'build'

	content = fs.readFileSync './bin/app.html', 'utf8'
	server = options.server or 'rally1'
	
	unless options.username and options.password
		console.error 'Please provide a username and password to deploy to Rally'
		process.exit -1
		
	unless projectOid > 0
		console.error 'Please provide a project oid in the Cakefile to deploy to Rally'
		process.exit -1
	
	d = new rabt.deploy.Deploy options.username, options.password, server + '.rallydev.com'

	if path.existsSync './appdef.json'
		oids = require './appdef'
		d.updatePage oids.dashboard, oids.panel, projectOid, name, 'myhome', content, () ->
			console.log "Page updated at https://#{server}.rallydev.com/#/#{projectOid}d/custom/" + oids.dashboard
	else
		d.createNewPage projectOid, name, content, 'myhome', (doid, poid) ->
			fs.writeFileSync './appdef.json', JSON.stringify {dashboard: doid, panel: poid}
			console.log "Page created at https://#{server}.rallydev.com/#/#{projectOid}d/custom/" + doid
