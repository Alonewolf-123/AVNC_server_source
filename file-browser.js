const { app, BrowserWindow } = require('electron')
const path = require('path')
const url = require('url')

let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800, 
        height: 800,
        webPreferences: {
            nodeIntegration: true
        }
    })
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'file-browser.html'),
        protocol: 'file:',
        slashes: true
    }))
    // uncomment this line in order to open DevTools
    // mainWindow.webContents.openDevTools()
    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
    app.quit()
})