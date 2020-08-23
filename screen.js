var {ipcRenderer} = require('electron')
var createPeerConnection = require('./peer.js')
var ui = require('./ui.js')
var connect = require('./connect.js')

var peerConnection = createPeerConnection()
try {
  if (!peerConnection.robot) peerConnection.robot = require('./robot.js')
} catch (e) {
  error(new Error('./robot.js failed to load'))
  error(e)
}

var g_peer
var g_screen_count
var g_control_enabled = true

ipcRenderer.send('window-ready', true)

ipcRenderer.on('peer-config', function (ev, config) {
  console.log("config::", config)
  connect.remote(peerConnection, ui, config.config, config.room)
})

peerConnection.on('connected', function connected (peer) {
  ui.show(ui.containers.multimedia)
  ui.hide(ui.containers.content)

  var screen_count = ui.containers.multimedia.childElementCount - 1
  g_screen_count = screen_count
  var screen_number = 0

  var i;
  for (i = 0; i < screen_count; i++) {
    if (screen_number !== i) {
      ui.containers.multimedia.childNodes[i + 1].style.display = "none"
    }
  }

  g_peer = peer

  peer.on('data', function (data) {
    console.log('pc_robot', peerConnection)
    if (peerConnection.robot) {
      console.log(data)
      peerConnection.robot(data)
    }
  })

  peer.on('error', function error (err) {
    console.error('peer error')
    console.error(err)
    ui.containers.content.innerHTML = 'Error connecting! Please Quit. ' + err.message
    ipcRenderer.send('disconnected', true)
    ipcRenderer.send('icon', 'disconnected')
  })

  peer.on('close', function close () {
    ipcRenderer.send('disconnected', true)
    ipcRenderer.send('icon', 'disconnected')
  })

  ScreenCountReset(screen_count)
  ipcRenderer.send('connected', true)
})

function ScreenCountReset(screen_count) {
    console.log('screen_count', screen_count)
    ui.containers.screen_buttons.innerHTML = ''

    var i;
    for (i = 0; i < screen_count; i++) {
      var button_html = "<a id='screen_" + i + "' class='screen_number-button small link tc pas db btn'>Screen " + (i + 1) + "</a>"
      ui.containers.screen_buttons.innerHTML += button_html
    }
}

ui.buttons.ctrlaltdel.addEventListener('click', function (e) {
  e.preventDefault()
  console.log('ctrl-alt-del sent', g_peer)
  var data = {
    event: true,
    content: "ctrl-alt-del"
  }
  var buf = Buffer.from(JSON.stringify(data));
  g_peer.send(buf)
})

ui.buttons.selectscreen.addEventListener('click', function (e) {
  e.preventDefault()
  ui.show(ui.containers.screen_buttons)
})

ui.buttons.stop_control.addEventListener('click', function (e) {
  e.preventDefault()
  console.log("g_control", g_control_enabled)
  if (g_control_enabled) {
    g_control_enabled = false
    ui.buttons.stop_control.innerHTML = "Start Control"
    ipcRenderer.send('control_enabled', g_control_enabled)
  } else {
    g_control_enabled = true
    ui.buttons.stop_control.innerHTML = "Stop Control"
    ipcRenderer.send('control_enabled', g_control_enabled)
  }
})

ui.buttons.file_transfer_button.addEventListener('click', function (e) {
  e.preventDefault()
  ipcRenderer.send('file_transfer_started')
})

document.addEventListener('click', function (e) {
  if (e.target) {
    var button_id = e.target.id
    if (button_id.indexOf("screen_") == 0) {
      var len = button_id.length
      var screen_number = button_id.substring(7, len)
      console.log('screen_number', screen_number)
      var i;
      for (i = 0; i < g_screen_count; i++) {
        if (screen_number != i) {
          ui.containers.multimedia.childNodes[i + 1].style.display = "none"
        } else {
          ui.containers.multimedia.childNodes[i + 1].style.display = "block"
        }
      }
    } 
  }
})
