/* global screen */
const { ipcRenderer } = require('electron')
var robot = require('robotjs')
const fs = require('fs');
const clipboard = require('electron-clipboard-extended')
const homedir = require('os').homedir()
const path = require('path')
const util = require('util')
const lstat = util.promisify(fs.lstat)
const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)

window.robot = robot
var vkey = require('vkey')
const tempDirectory = require('temp-dir');
var path_ScreenInfo = tempDirectory + "\\screen_info.json"
console.log('path_screeninfo', path_ScreenInfo)
let rawdata = fs.readFileSync(path_ScreenInfo);
let screen_info = JSON.parse(rawdata);
var curPath = homedir

var incomingFileName;
var incomingFileSize;
var incomingFileData;
var bytesReceived;
var downloadInProgress = false;
var fileStream

console.log(screen_info);

module.exports = async function createEvents (buf) {
  var data = JSON.parse(buf.toString());
  if (data.mouse_event > 0 && data.mouse_event < 4) {
    var screen_bounds = screen_info[data.screen_number]['Bounds'].split(',')
    var x_left = parseFloat(screen_bounds[0])
    var y_top = parseFloat(screen_bounds[1])
    var screenWidth = parseFloat(screen_bounds[2])
    var screenHeight = parseFloat(screen_bounds[3])
    var x = scale(data.clientX, 0, data.canvasWidth, 0, screenWidth) + x_left
    var y = scale(data.clientY, 0, data.canvasHeight, 0, screenHeight) + y_top
    robot.moveMouse(x, y) // move to remotes pos
    // console.log('x', x)
    // console.log('y', y)
    if (data.mouse_event == 2) {
      if (data.button == 0) {
        robot.mouseToggle('down', 'left') // set mouse position to left down
      }
      if (data.button == 2) {
        robot.mouseToggle('down', 'right') // set mouse position to right down
      }
    }
    if (data.mouse_event == 3) {
      if (data.button == 0) {
        robot.mouseToggle('up', 'left') // set mouse position to left up
      }
      if (data.button == 2) {
        robot.mouseToggle('up', 'right') // set mouse position to right up
      }
    }

    // robot.mouseClick() // click on remote click spot
  }

  if (data.mouse_event == 4) {
    // console.log('scroll', data)
    var deltaX = parseInt(data.deltaX)
    var deltaY = -parseInt(data.deltaY)
    robot.scrollMouse(deltaX, deltaY)
  }

  if (data.keyCode) {
    var k = vkey[data.keyCode].toLowerCase()
    if (k === '<space>') k = ' '
    var modifiers = []
    if (data.shift) modifiers.push('shift')
    if (data.control) modifiers.push('control')
    if (data.alt) modifiers.push('alt')
    if (data.meta) modifiers.push('command')
    if (k[0] !== '<') {
      console.log('typed ' + k + ' ' + JSON.stringify(modifiers))
      if (modifiers[0]) robot.keyTap(k, modifiers[0])
      else robot.keyTap(k)
    } else {
      if (k === '<enter>') robot.keyTap('enter')
      else if (k === '<backspace>') robot.keyTap('backspace')
      else if (k === '<up>') robot.keyTap('up')
      else if (k === '<down>') robot.keyTap('down')
      else if (k === '<left>') robot.keyTap('left')
      else if (k === '<right>') robot.keyTap('right')
      else if (k === '<delete>') robot.keyTap('delete')
      else if (k === '<home>') robot.keyTap('home')
      else if (k === '<end>') robot.keyTap('end')
      else if (k === '<page-up>') robot.keyTap('pageup')
      else if (k === '<page-down>') robot.keyTap('pagedown')
      else console.log('did not type ' + k)
    }
  }

  if (data.event) {
    console.log('event', data.content)
    if (data.content == 'ctrl-alt-del') {
      ipcRenderer.send('ctrl-alt-del_received')
    }
  }

  if (data.clipboard_text) {
    console.log('clipboard', data.content)
    if (data.clipboard_text) {
      clipboard.writeText(data.content)
    }
  }

  if (data.folder_content_requested) {
    console.log('folder_content_requested', data.path)
    if (data.path == 'homedir') {
      curPath = homedir
    } else if (data.path == '..') {
      curPath = path.dirname(curPath)
    } else if (data.path == '.') {
      curPath = curPath
    } else {
      curPath = data.path
    }

    console.log('curpath', curPath)

    const files = await readdir(curPath)
    var file_datas = []
    for (let i = 0; i < files.length; i++) {
      var filePath = curPath + "\\" + files[i];
      try {
          const fileStat = await lstat(filePath);
          if (fileStat.isDirectory()) {
            file_datas.push({ id: i, name: files[i], isFolder: true })
          } else {
            file_datas.push({ id: i, name: files[i], isFolder: false })
          }
      } catch (e0) {
          console.log(e0);
      }
    }

    var send_data = {
      folder_content_response: true,
      path: curPath,
      files: file_datas
    }
    ipcRenderer.send('folder_content_response', send_data)
  }

  if (data.FileUpload_requested) {
    incomingFileName = data.fileName
    incomingFileSize = data.fileSize
    incomingFileData = []
    bytesReceived = 0
    downloadInProgress = true
    var filePath = curPath + '\\' + incomingFileName
    var fileExisted = false
    if (fs.existsSync(filePath)) {
      console.log('file existed', filePath)
      fileExisted = true
    } else {
      fileStream = fs.createWriteStream(filePath)
    }

    ipcRenderer.send('FileUpload_response', fileExisted)
  }

  if (data.FileUpload_started) {
    incomingFileName = data.fileName
    incomingFileSize = data.fileSize
    incomingFileData = []
    bytesReceived = 0
    downloadInProgress = true
    console.log( 'incoming file <b>' + incomingFileName + '</b> of ' + incomingFileSize + ' bytes' )
    var filePath = curPath + '\\' + incomingFileName
    fileStream = fs.createWriteStream(filePath)
  }

  if (data.FileData) {
    const buf = Buffer.from(data.content.data);
    console.log('data.content', buf)
    fileStream.write(buf)
    bytesReceived = bytesReceived + data.content_length
    if (bytesReceived >= incomingFileSize) {
      fileStream.end()
    }
  }

  if (data.FileUpload_ended) {
    console.log('file upload ended')
    if (fileStream)
      fileStream.end()
  }

  if (data.FileDownload_requested) {
    var fileLength = getFilesizeInBytes(data.path)
    if (fileLength < 3221225472) {  //if file size is smaller than 3GB
        console.log('file name/size', this.selectedFile, fileLength)
        fileName = path.basename(data.path)
        var filedata = {
          FileDownload_started: true,
          filePath: data.path,
          fileName: fileName,
          fileSize: fileLength
        }
        ipcRenderer.send('filedownload_data_send', filedata)
    }
  }

  if (data.FileDownload_ended) {
    console.log('file download ended')
    ipcRenderer.send('FileDownload_ended')
  }

}

function getFilesizeInBytes(filename) {
  var stats = fs.statSync(filename)
  var fileSizeInBytes = stats["size"]
  return fileSizeInBytes
}

function scale (x, fromLow, fromHigh, toLow, toHigh) {
  return (x - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow
}
