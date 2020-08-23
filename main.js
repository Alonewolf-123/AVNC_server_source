const { app, ipcMain, BrowserWindow } = require('electron')
var path = require('path')
var execFile = require('child_process').execFile, child;
var filePath = require('path').join(__dirname,'..\\..\\ScreenResolutionGrabber.exe')
const url = require('url')
child = execFile(filePath, function callback(error, stdout, stderr){
  if (error) {
    //console.log(error.stack); 
    //console.log('Error code: '+ error.code); 
    //console.log('Signal received: '+ 
    //       error.signal);
    }
    //console.log('Child Process stdout: '+ stdout);
    //console.log('Child Process stderr: '+ stderr);
}); 

var icons = {
  connected: path.join(__dirname, 'img', 'IconRed.png'),
  disconnected: path.join(__dirname, 'img', 'Icon.png')
}

var g_hostpeer = null

var main_window = null

function createWindow() {
  main_window = new BrowserWindow({
    width: 700, 
    height: 300, 
    webPreferences: {
      nodeIntegration: true
    }
  })

  // main_window.setMenu(null)
  
  main_window.loadURL('file://' + path.join(__dirname, 'app.html'))

  main_window.on('close', function () {
    main_window.webContents.send('peer-destroy')
    // closeAllWindows()
  })
}

function closeAllWindows() {
  try {
    if (main_window) {
      main_window.close()
    }
  } catch (e) {
    console.log('close main_window', e)
  }
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
    app.quit()
})

ipcMain.on('terminate', function terminate (ev) {
  app.quit()
})

ipcMain.on('resize', function resize (ev, data) {
  main_window.setSize(data.width, data.height)
})

ipcMain.on('error', function error (ev, err) {
  console.error(new Error(err.message))
})

let file_transfer_window

ipcMain.on('file_transfer_started', function (ev) {
  console.log('file_transfer_started')
  file_transfer_window = new BrowserWindow({width: 800, height: 800 })
    file_transfer_window.loadURL(url.format({
        pathname: path.join(__dirname, 'file-browser.html'),
        protocol: 'file:',
        slashes: true
    }))
    // uncomment this line in order to open DevTools
    // file_transfer_window.webContents.openDevTools()
    file_transfer_window.on('closed', () => {
        file_transfer_window = null
    })
})

ipcMain.on('ctrl-alt-del_received', function () {
  var execFile = require('child_process').execFile, child;
      var filePath = require('path').join(__dirname,'..\\..\\ServiceInstaller.exe')
      child = execFile(filePath, function callback(error, stdout, stderr){
        if (error) {
          //console.log(error.stack); 
          //console.log('Error code: '+ error.code); 
          //console.log('Signal received: '+ 
          //       error.signal);
          }
      }); 
})

ipcMain.on('folder_content_response', function (ev, send_data) {
  if (main_window) main_window.webContents.send('folder_content_response', send_data)
})

ipcMain.on('FileUpload_response', function (ev, fileExisted) {
  if (main_window) main_window.webContents.send('FileUpload_response', fileExisted)
})

ipcMain.on('filedownload_data_send', function (ev, filedata) {
  if (main_window) main_window.webContents.send('filedownload_data_send', filedata)
})

ipcMain.on('FileDownload_ended', function (ev) {
  if (main_window) main_window.webContents.send('FileDownload_ended')
})