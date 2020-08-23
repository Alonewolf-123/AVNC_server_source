var ui = {}

module.exports = ui

ui.show = show
ui.hide = hide

ui.containers = {
  share: document.querySelector('.share-container'),
  join: document.querySelector('.join-container'),
  content: document.querySelector('.content-container'),
  choose: document.querySelector('.choose-container'),
  capturer: document.querySelector('.capturer-container'),
  button_container: document.querySelector('.button-container'),
  multimedia: document.querySelector('.multimedia-container'),
  sharing: document.querySelector('.sharing-container'),
  viewing: document.querySelector('.viewing-container'),
  screen_buttons: document.querySelector('.screen_buttons-container'),
  mdns: document.querySelector('.code-mdns')
}

ui.buttons = {
  share: document.querySelector('.share-button'),
  join: document.querySelector('.join-button'),
  copy: document.querySelector('.code-copy-button'),
  paste: document.querySelector('.code-paste-button'),
  quit: document.querySelector('.quit-button'),
  back: document.querySelector('.back-button'),
  destroy: document.querySelector('.sharing-container .destroy-button'),
  stopViewing: document.querySelector('.viewing-container .destroy-button'),
  show: document.querySelector('.viewing-container .show-button'),
  ctrlaltdel: document.querySelector('.button-container .ctrlaltdel-button'),
  selectscreen: document.querySelector('.button-container .selectscreen-button'),
  stop_control: document.querySelector('.button-container .stop_control-button'),
  file_transfer_button: document.querySelector('.button-container .file_transfer-button'),
  screen_number_button: document.querySelector('.viewing-container .screen_number-button'),
  mdns: document.querySelector('.code-mdns-button')
}

ui.inputs = {
  copy: document.querySelector('.code-copy-input'),
  paste: document.querySelector('.code-paste-input')
}

function show (ele) {
  if (!ele) return
  ele.classList.remove('dn')
}

function hide (ele) {
  if (!ele) return
  ele.classList.add('dn')
  ele.classList.remove('db')
}
