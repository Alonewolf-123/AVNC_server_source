/* global screen, EventSource */
var {ipcRenderer} = require('electron')
var zlib = require('zlib')
var events = require('events')
var SimplePeer = require('simple-peer')
var nets = require('nets')
const clipboard = require('electron-clipboard-extended')
var getUserMedia = require('./get-user-media.js')()
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

var g_hostpeer
var g_remotepeer

module.exports = function create () {
  var server = 'SERVER_URL'
  var remoteConfigUrl = 'REMOTE_URL'
  if (process.browser) remoteConfigUrl = 'REMOTE_CONFIG' + remoteConfigUrl

  var videoSize

  var defaultConstraints = [{
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'screen',
        maxWidth: screen.availWidth,
        maxHeight: screen.availHeight,
        maxFrameRate: 25
      },
      optional: []
    }
  }]

  var pc = new events.EventEmitter()
  pc.getRemoteConfig = getRemoteConfig
  pc.verifyRoom = verifyRoom
  pc.remotePeer = remotePeer
  pc.hostPeer = hostPeer
  pc.handleSignal = handleSignal
  pc.videoElement = videoElement
  pc.audioElement = audioElement
  pc.onConnect = onConnect
  pc.createRoom = createRoom
  pc.setControlEnabled = setControlEnabled
  pc.sendData = sendData

  return pc

  function setControlEnabled(control_enabled) {
    g_control_enabled = control_enabled
    console.log("control_enabled_changed", g_control_enabled)
  }

  function sendData(send_data) {
    if (g_hostpeer) {
      var buf = Buffer.from(JSON.stringify(send_data));
      g_hostpeer.send(buf)
    }
  }

  function verifyRoom (room, cb) {
    // ensure room is still open
    nets({method: 'POST', uri: server + '/v1/' + room + '/pong', json: {ready: true}}, function response (err, resp, data) {
      if (err) return cb(err)
      if (resp.statusCode !== 200) return cb(new Error('Invalid or expired invite code'))
      cb()
    })
  }

  // get remote webrtc config (ice/stun/turn)
  function getRemoteConfig (cb) {
    // nets({url: remoteConfigUrl, json: true}, function gotConfig (err, resp, config) {
    //   if (err || resp.statusCode > 299) config = undefined // ignore errors
    //   cb(null, config)
    // })
    var config = { iceServers: [{
      username: "<USERNAME>",
      credential: "<PASSWORD>",
      url: '<URL>'
      }] }

    cb(null, config)
  }

  // try getusermedia and then upload sdp pong. this causes host to ping sdp back
  function getAudio (cb) {
    getUserMedia({audio: true, video: false}, function ok (stream) {
      cb(null, stream)
    },
    function error (err) {
      // screenshare even if remote doesnt wanna do audio
      if (err.name === 'PermissionDeniedError' || err.name === 'DevicesNotFoundError') {
        cb()
      } else {
        cb(err)
      }
    })
  }

  function remotePeer (config, room, cb) {
    // listen for pings
    var pingsUrl = server + '/v1/' + room + '/pings'
    console.log('getting pings', pingsUrl)
    var events = new EventSource(pingsUrl)
    events.onmessage = function onMessage (e) {
      console.log('pings onmessage', e.data)
      var row
      try {
        row = JSON.parse(e.data)
      } catch (e) {
        row = {}
        return cb(new Error('Error connecting. Please start over.'))
      }

      if (!row.data) {
        return
      }

      inflate(row.data, function inflated (err, stringified) {
        if (err) return cb(err)

        pc.emit('getting-audio')
        getAudio(function got (err, audioStream) {
          if (err) return handleRTCErr(err, cb)
          var peer = new SimplePeer({ trickle: false, config: config })
          g_remotepeer = peer
          if (audioStream) peer._pc.addStream(audioStream)
          peer.signal(JSON.parse(stringified.toString()))
          cb(null, peer)
        })
      })

      events.close()
    }

    events.onerror = function onError (e) {
      cb(new Error('Error connecting. Please start over.'))
      events.close()
    }
  }

  function createRoom (cb) {
    console.log('get room posted')
    nets({method: 'POST', uri: server + '/v1'}, function response (err, resp, body) {
      if (err) return cb(err)
      var room = JSON.parse(body)
      cb(null, room.name)
    })
  }

  function hostPeer (opts, cb) {
    var room = opts.room
    var config = opts.config
    var constraints = opts.constraints || defaultConstraints
    var peer

    // listen for pongs
    var events = new EventSource(server + '/v1/' + room + '/pongs')
    events.onmessage = function onMessage (e) {
      console.log('pongs onmessage', e.data)
      var row
      try {
        row = JSON.parse(e.data)
      } catch (e) {
        return cb(new Error('Error connecting. Please start over.'))
      }

      // other side is ready
      if (row.ready) {
        connect(row.data)
      }

      // sdp from other side
      if (row.data) {
        console.log('pongs data', row.data)
        inflate(row.data, function inflated (err, stringified) {
          if (err) {
            return cb(new Error('Error connecting. Please start over.'))
          }

          peer.signal(JSON.parse(stringified.toString()))
        })
        events.close()
      }

      function connect (pong) {

        var videoStreamList = []

        // screensharing
        screen_count = constraints.length
        var i = 0
        constraints.forEach(function (constraint) {
          getUserMedia(constraint, function (videoStream) {
            videoStreamList.push(videoStream)
            i++
            if (i == screen_count) {
              peer = new SimplePeer({ initiator: true, trickle: false, config: config })
              g_hostpeer = peer
              videoStreamList.forEach(element => {
                peer._pc.addStream(element)
              })
              pc.emit('waiting-for-peer')
              cb(null, peer)
            }
          }, function (err) { handleRTCErr(err, cb) })
        })
        console.log('video streams', videoStreamList)

          // videoStreamList.forEach(element => {
          //   peer._pc.addStream(element)
          // })
          // pc.emit('waiting-for-peer')
          // cb(null, peer)
        // audio
        // getUserMedia({audio: true, video: false}, function (audioStream) {
        //   peer = new SimplePeer({ initiator: true, trickle: false, config: config })
        //   g_hostpeer = peer
        //   videoStreamList.forEach(element => {
        //     peer._pc.addStream(element)
        //   })
        //   // console.log('audioStream', audioStream)
        // //   // peer._pc.addStream(audioStream)
        //   pc.emit('waiting-for-peer')
        //   cb(null, peer)
        // }, function (err) { handleRTCErr(err, cb) })
      }
    }

    events.onerror = function onError (e) {
      cb(e)
      events.close()
    }
  }

  function handleRTCErr (err, cb) {
    if (err.name === 'PermissionDeniedError') {
      console.error('permission denied')
      console.error(err)
      cb(new Error('Screensharing permission denied'))
    } else {
      console.error('Unknown error', err)
      cb(err)
    }
  }

  function handleSignal (sdp, peer, remote, room, cb) {
    deflate(sdp, function deflated (err, data) {
      if (err) return cb(err)

      // upload sdp
      var uploadURL = server + '/v1/' + room
      if (remote) uploadURL += '/pong'
      else uploadURL += '/ping'

      console.log('POST', uploadURL)
      nets({method: 'POST', json: {data: data}, uri: uploadURL}, function response (err, resp, body) {
        if (err || resp.statusCode > 299) return cb(err)
        cb(null)
      })
    })
  }

  function onConnect (peer, remote) {
    pc.emit('connected', peer, remote)

    var video

    if (remote) {
      ipcRenderer.send('icon', 'connected')
      window.addEventListener('mousemove', mousemoveListener)
      window.addEventListener('mousedown', mousedownListener)
      window.addEventListener('mouseup', mouseupListener)
      window.addEventListener('keydown', keydownListener)
    }

    if (!remote) {
      peer.on('data', function (data) {
        if (!pc.robot) return
        pc.robot(data)
      })
      return
    }

    peer.on('close', function cleanup () {
      ipcRenderer.send('icon', 'disconnected')
      window.removeEventListener('mousemove', mousemoveListener)
      window.removeEventListener('mousedown', mousedownListener)
      window.removeEventListener('mouseup', mouseupListener)
      window.removeEventListener('keydown', keydownListener)
    })

    peer.on('error', function error (err) {
      ipcRenderer.send('icon', 'disconnected')
      window.removeEventListener('mousemove', mousemoveListener)
      window.removeEventListener('mousedown', mousedownListener)
      window.removeEventListener('mouseup', mouseupListener)
      window.removeEventListener('keydown', keydownListener)
    })

    function mousemoveListener (e) {
      if (g_control_enabled) {
        var data = getMouseData(e)
        data.mouse_event = 1
        // console.log('send mousemove', data)
        var buf = Buffer.from(JSON.stringify(data));
        peer.send(buf)
      }
    }

    function mousedownListener (e) {
      if (g_control_enabled) {
        var data = getMouseData(e)
        data.mouse_event = 2
        // console.log('send mousedown', data)
        var buf = Buffer.from(JSON.stringify(data));
        peer.send(buf)
      }
    }

    function mouseupListener (e) {
      if (g_control_enabled) {
        var data = getMouseData(e)
        data.mouse_event = 3
        // console.log('send mouseup', data)
        var buf = Buffer.from(JSON.stringify(data));
        peer.send(buf)
      }
    }

    function keydownListener (e) {
      if (g_control_enabled) {
        e.preventDefault()

        var data = {
          keyCode: e.keyCode,
          shift: e.shiftKey,
          meta: e.metaKey,
          control: e.ctrlKey,
          alt: e.altKey
        }

        // console.log('send key', data)
        var buf = Buffer.from(JSON.stringify(data));
        peer.send(buf)
      }
    }

    function getMouseData (e) {
      var data = {}
      data.clientX = e.clientX
      data.clientY = e.clientY - 30 + window.scrollY
      data.button = e.button

      var screen_count = ui.containers.multimedia.childElementCount - 1
      var i;
  
      var screen_number = 0
      for (i = 0; i < screen_count; i++) {
        if (ui.containers.multimedia.childNodes[i + 1].style.display != "none") {
          video = ui.containers.multimedia.childNodes[i + 1]
          screen_number = i;
          break;
        }
      }
      
      if (video) {
        videoSize = video.getBoundingClientRect()
        data.canvasWidth = videoSize.width
        data.canvasHeight = videoSize.height
        data.screen_number = i
      }

      return data
    }

  }

  function videoElement (stream) {
    var video = document.createElement('video')
    video.src = window.URL.createObjectURL(stream)
    video.autoplay = true
    return video
  }

  function audioElement (stream) {
    var audio = document.createElement('audio')
    audio.src = window.URL.createObjectURL(stream)
    audio.autoplay = true
    return audio
  }

  function inflate (data, cb) {
    data = decodeURIComponent(data.toString())
    zlib.inflate(new Buffer.from(data, 'base64'), cb)
  }

  function deflate (data, cb) {
    // sdp is ~2.5k usually, that's too big for a URL, so we zlib deflate it
    var stringified = JSON.stringify(data)
    zlib.deflate(stringified, function (err, deflated) {
      if (err) {
        cb(err)
        return
      }
      var connectionString = deflated.toString('base64')
      var code = encodeURIComponent(connectionString)
      cb(null, code)
    })
  }
}

clipboard
.on('text-changed', () => {
    let currentText = clipboard.readText()
  try {
    var data = {
      clipboard_text: true,
      content: currentText
    }
    if (g_hostpeer) {
      var buf = Buffer.from(JSON.stringify(data));
      g_hostpeer.send(buf)
      console.log('hostpeer', currentText)
    }
    if (g_remotepeer) {
      var buf = Buffer.from(JSON.stringify(data));
      g_remotepeer.send(buf)
    }
  } catch (e) {
    console.log('text-changed clipboard', e)
  }
})

.on('image-changed', () => {
    let currentIMage = clipboard.readImage()
    
})
.startWatching();