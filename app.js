/* global screen */
var clipboard = require('electron-clipboard-extended')
var shell = require('shell')
const { ipcRenderer, desktopCapturer } = require('electron')
var $ = require('jQuery')
const readChunk = require('read-chunk');

var domify = require('domify')
var mdns = require('multicast-dns')()
var createPeerConnection = require('./peer.js')
var ui = require('./ui.js')
var connect = require('./connect.js')

var peer
var peerConnection = createPeerConnection()
window.ui = ui
window.pc = peerConnection

mdns.on('query', function (query) {
  if (!ui.inputs.copy.value) return
  query.questions.forEach(function (q) {
    if (q.type === 'TXT' && q.name === 'avnc') {
      mdns.respond([{type: 'TXT', name: 'avnc', data: ui.inputs.copy.value}])
    }
  })
})

mdns.on('response', function (res) {
  res.answers.forEach(function (a) {
    if (a.type === 'TXT' && a.name === 'avnc') {
      ui.buttons.mdns.innerText = a.data
      ui.show(ui.containers.mdns)
    }
  })
})

peerConnection.on('connected', function connected (newPeer, remote) {
  peer = newPeer

  console.log('new peer connected', peer)

  if (!remote) {
    ipcRenderer.send('icon', 'connected')
    ui.show(ui.containers.sharing)
    ui.hide(ui.containers.content)
  } else {
    ui.show(ui.containers.multimedia)
    ui.hide(ui.containers.content)
  }

  peer.on('error', function error (err) {
    peer.destroy()
    CreateRoom()
    showChoose()
  })

  peer.on('close', function close () {
    ipcRenderer.send('icon', 'disconnected')
    CreateRoom()
    showChoose()
  })
})

ipcRenderer.on('ready-server', function (ev) {
  console.log('ready-server')
})

ipcRenderer.on('open-url', function (ev, lnk) {
  console.log('open url', lnk)
})

ipcRenderer.on('connected', function (ev) {
  ui.hide(ui.containers.content)
  ui.show(ui.containers.viewing)
  ipcRenderer.send('icon', 'connected')
})

ipcRenderer.on('disconnected', function (ev) {
  console.log('disconnected')
  ipcRenderer.send('icon', 'disconnected')
  CreateRoom()
  showChoose()
})

ipcRenderer.on('control_enabled-set', function (ev, control_enabled) {
  console.log('control_enabled', control_enabled)
  if (peerConnection) {
    peerConnection.setControlEnabled(control_enabled)
  }
})

ui.buttons.quit.addEventListener('click', function (e) {
  ipcRenderer.send('terminate')
})

ui.buttons.destroy.addEventListener('click', function (e) {
  if (peer) {
    peer.destroy()
  }
  ui.hide(ui.containers.choose)
  ui.hide(ui.buttons.back)
  ui.show(ui.containers.share)
})

ui.buttons.share.addEventListener('click', function (e) {
  var sourcesList = document.querySelector('.capturer-list')
  sourcesList.innerHTML = ''
  ui.hide(ui.containers.choose)
  ui.show(ui.buttons.back)
  try {
    if (!peerConnection.robot) peerConnection.robot = require('./robot.js')
  } catch (e) {
    error(new Error('./robot.js failed to load'))
    error(e)
  }
  desktopCapturer.getSources({types: ['screen']}, function (err, sources) {
    if (err) return error(err)
    ui.hide(ui.containers.choose)
    var constraints = []
    sources.forEach(function (source) {
      constraints.push(
        {
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxWidth: screen.availWidth,
              maxHeight: screen.availHeight,
              maxFrameRate: 25
            }
          }
        }
      )
    })
    var opts = {
      constraints: constraints
    }
    ui.show(ui.containers.share)
    connect.host(peerConnection, ui, opts)
  })
})

ui.buttons.mdns.addEventListener('click', function (e) {
  ui.inputs.paste.value = ui.buttons.mdns.innerText.trim()
  ui.buttons.paste.click()
})

ui.buttons.join.addEventListener('click', function (e) {
  ui.inputs.copy.value = ''
  ui.hide(ui.containers.mdns)
  ui.show(ui.containers.join)
  ui.hide(ui.containers.choose)
  ui.show(ui.buttons.back)

  var interval = setInterval(query, 1000)
  query()

  connect.verifyUserRoom(peerConnection, ui, function (err, room, config) {
    clearInterval(interval)
    if (err) {
      ui.inputs.paste.value = 'Error! ' + err.message
      return
    }
    ui.inputs.paste.value = 'Waiting on other side...'
    ipcRenderer.send('create-window', {config: config, room: room})
  })

  function query () {
    mdns.query([{type: 'TXT', name: 'avnc'}])
  }
})

ui.buttons.back.addEventListener('click', function (e) {
  // HACK do a clone-swap to remove listeners
  var el = ui.buttons.paste
  var elClone = el.cloneNode(true)
  el.parentNode.replaceChild(elClone, el)
  ui.buttons.paste = elClone

  showChoose()
})

ui.buttons.copy.addEventListener('click', function (e) {
  e.preventDefault()
  clipboard.writeText(ui.inputs.copy.value)
})

ui.buttons.show.addEventListener('click', function (e) {
  e.preventDefault()
  ipcRenderer.send('show-window')
})

ui.buttons.stopViewing.addEventListener('click', function (e) {
  e.preventDefault()
  ipcRenderer.send('stop-viewing')
})

function showChoose () {
  ui.hide(ui.containers.viewing)
  ui.hide(ui.containers.sharing)
  ui.hide(ui.containers.multimedia)
  ui.show(ui.containers.content)
  ui.hide(ui.containers.choose)
  ui.show(ui.containers.share)
  ui.hide(ui.containers.join)
  ui.hide(ui.buttons.back)
  ui.hide(ui.containers.capturer)
}

var externalLinks = document.querySelectorAll('.open-externally')
for (var i = 0; i < externalLinks.length; i++) {
  externalLinks[i].onclick = function (e) {
    e.preventDefault()
    shell.openExternal(e.target.href)
    return false
  }
}

function error (e) {
  // TODO: Display this as a site flash in addition to the app console
  ipcRenderer.send('error', {message: e.message, name: e.name})
  console.error(e)
}

ipcRenderer.on('server_clipboard-text-changed', function (ev, currentText) {
  console.log('server_clipboard-text-changed', currentText)
  if (peerConnection) {
    peerConnection.setControlEnabled(control_enabled)
  }
})

ipcRenderer.on('folder_content_response', function (ev, send_data) {
  if (peerConnection) {
    peerConnection.sendData(send_data)
  }
})

ipcRenderer.on('peer-destroy', function (ev) {
  peer.destroy()
})

ipcRenderer.on('FileUpload_response', function (ev, fileExisted) {
  var data = {
    FileUpload_response: true,
    fileExisted: fileExisted
  }
  peerConnection.sendData(data)
})

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}  

var g_FileDownload_ended = false
var BytesPerChunk = 1024
async function SendFile(fileSelectedPath, fileSize) {

  var bytes_sent = 0

  await sleep(1000);

  while (bytes_sent < fileSize) {
    if (g_FileDownload_ended == true) 
      break
    
    var len = BytesPerChunk
    if (bytes_sent + BytesPerChunk > fileSize) {
      len = fileSize - bytes_sent
    }
    var chunk = readChunk.sync(fileSelectedPath, bytes_sent, len);
    var fileData = {
      FileData: true,
      content: chunk,
      content_length: len
    }
    bytes_sent += len
    peerConnection.sendData(fileData)
    console.log('chunk', chunk);
    await sleep(100);
  }
}

ipcRenderer.on('filedownload_data_send', function (ev, file_data) {
  if (peerConnection) {
    peerConnection.sendData(file_data)
  }
  g_FileDownload_ended = false
  SendFile(file_data.filePath, file_data.fileSize)
})

ipcRenderer.on('FileDownload_ended', function (ev) {
  g_FileDownload_ended = true
})

function CreateRoom() {
  var sourcesList = document.querySelector('.capturer-list')
  sourcesList.innerHTML = ''
  ui.hide(ui.containers.choose)
  ui.hide(ui.buttons.back)
  try {
    if (!peerConnection.robot) peerConnection.robot = require('./robot.js')
  } catch (e) {
    error(new Error('./robot.js failed to load'))
    error(e)
  }
  console.log('getsources called')
  desktopCapturer.getSources({ types: ['screen'] }).then(async sources => {
    ui.hide(ui.containers.choose)
    var constraints = []
    sources.forEach(function (source) {
      constraints.push(
        {
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxWidth: screen.availWidth,
              maxHeight: screen.availHeight,
              maxFrameRate: 25
            }
          }
        }
      )
    })
    var opts = {
      constraints: constraints
    }
    ui.show(ui.containers.share)
    console.log('host called')
    connect.host(peerConnection, ui, opts)
  })
}

// A $( document ).ready() block.
$( document ).ready(function() {
  console.log( "ready!" );
  CreateRoom()
});