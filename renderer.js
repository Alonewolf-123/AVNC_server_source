const path = require('path')
const util = require('util')
const fs = require('fs')

const lstat = util.promisify(fs.lstat)
const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)

Vue.component('listing', {
    props: ['item'],
    template: '<div class="listing-item" @dblclick="clicked(item.name)"><i v-if="item.isFolder" class="fa fa-folder-o"></i><i v-else class="fa fa-file-o"></i>&nbsp;{{ item.name }}</div>',
    methods: {
        clicked(n) {
            this.selectedFile = null;
            this.selectedFileId = null;
            go(path.format({ dir: app.location, base: n }), true);
        }
    }
})

Vue.component('listingremote', {
    props: ['item'],
    template: '<div class="listing-item" @dblclick="clicked(item.name)"><i v-if="item.isFolder" class="fa fa-folder-o"></i><i v-else class="fa fa-file-o"></i>&nbsp;{{ item.name }}</div>',
    methods: {
        clicked(n) {
            this.selectedFileRemote = null;
            this.selectedFileRemoteId = null;
            go(path.format({ dir: app.locationRemote, base: n }), false);
        }
    }
})

const app = new Vue({
    el: '#app',
    data: {
        location: process.cwd(),
        files: [],
        tmpFiles: [],
        image: null,
        fileContent: null,
        locationRemote: process.cwd(),
        filesRemote: [],
        tmpFilesRemote: [],
        imageRemote: null,
        fileContentRemote: null,
        selectedFile: null,
        selectedFileRemote: null,
        selectedFileId: null,
        selectedFileRemoteId: null
    },
    created: async function() {
        
        try {
            const files = await readdir(this.location);
            for(let i = 0; i < files.length; i++) {
                filePath = this.location + "\\" + files[i];
                const fileStat = await lstat(filePath);
                if (fileStat.isDirectory()) {
                    this.files.push({ id: i, name: files[i], isFolder: true })
                    this.filesRemote.push({ id: i, name: files[i], isFolder: true })
                    this.tmpFiles.push({ id: i, name: files[i], isFolder: true })
                    this.tmpFilesRemote.push({ id: i, name: files[i], isFolder: true })
                } else {
                    this.files.push({ id: i, name: files[i], isFolder: false })
                    this.filesRemote.push({ id: i, name: files[i], isFolder: false })
                    this.tmpFiles.push({ id: i, name: files[i], isFolder: false })
                    this.tmpFilesRemote.push({ id: i, name: files[i], isFolder: false })
                }
            }
            this.files = rearrange(this.files);
            this.filesRemote = rearrange(this.filesRemote);
        } catch (e) {
            console.log(e)
        }
        
    },
    methods: {
        up () {
            this.selectedFile = null;
            this.selectedFileId = null;
            go(path.dirname(this.location), true);
        },
        upRemote () {
            this.selectedFileRemote = null;
            this.selectedFileRemoteId = null;
            go(path.dirname(this.locationRemote), false);
        },
        selected (name, id) {
            this.selectedFile = this.location + "\\" + name;
            console.log(this.selectedFile);
            if (this.selectedFileId == null) {
                document.getElementById("file-" + id).style.backgroundColor = "#dcdcd3";
            } else {
                document.getElementById("file-" + id).style.backgroundColor = "#dcdcd3";
                document.getElementById("file-" + this.selectedFileId).style.backgroundColor = "#f5f5f4";
            } 
            this.selectedFileId = id;

        },
        selectedRemote (name, id) {
            this.selectedFileRemote = this.locationRemote + "\\" + name;
            console.log(this.selectedFileRemote);
            if (this.selectedFileRemoteId == null) {
                document.getElementById("file-remote-" + id).style.backgroundColor = "#dcdcd3";
            } else {
                document.getElementById("file-remote-" + id).style.backgroundColor = "#dcdcd3";
                document.getElementById("file-remote-" + this.selectedFileRemoteId).style.backgroundColor = "#f5f5f4";
            } 
            this.selectedFileRemoteId = id;
        },
        async refresh () {
            try {
                this.files = [];
                this.tmpFiles = [];
                const files = await readdir(this.location);
                for(let i = 0; i < files.length; i++) {
                    filePath = this.location + "\\" + files[i];
                    const fileStat = await lstat(filePath);
                    if (fileStat.isDirectory()) {
                        this.files.push({ id: i, name: files[i], isFolder: true })
                        this.tmpFiles.push({ id: i, name: files[i], isFolder: true })
                    } else {
                        this.files.push({ id: i, name: files[i], isFolder: false })
                        this.tmpFiles.push({ id: i, name: files[i], isFolder: false })
                    }
                }
                this.files = rearrange(this.files);
            } catch (e) {
                console.log(e)
            }
        },
        async refreshRemote () {
            try {
                this.filesRemote = [];
                this.tmpFilesRemote = [];
                const files = await readdir(this.locationRemote);
                for(let i = 0; i < files.length; i++) {
                    filePath = this.locationRemote + "\\" + files[i];
                    const fileStat = await lstat(filePath);
                    if (fileStat.isDirectory()) {
                        this.filesRemote.push({ id: i, name: files[i], isFolder: true })
                        this.tmpFilesRemote.push({ id: i, name: files[i], isFolder: true })
                    } else {
                        this.filesRemote.push({ id: i, name: files[i], isFolder: false })
                        this.tmpFilesRemote.push({ id: i, name: files[i], isFolder: false })
                    }
                }
                this.filesRemote = rearrange(app.filesRemote);
            } catch (e) {
                console.log(e)
            }
        },
        filterCurrentFiles ({ currentTarget: { value }}) {
           if (!value) {
               this.files = this.tmpFiles
           } else {
               this.files = this.files.filter((file) => file.name.indexOf(value) > -1)
           }
        }
    }
})

async function go(currentPath, isRemote) {
    if (isRemote == true) {
        if(currentPath.endsWith('.bpm') || currentPath.endsWith('.png') || currentPath.endsWith('.gif') || currentPath.endsWith('.jpg')) {
            app.image = 'file://' + currentPath;
        } else {
            app.image = null
            app.fileContent = null
            app.files = []
            app.tmpFiles = []
            
            try {
                const stat = await lstat(currentPath)
                
                if (stat.isDirectory()) {
                    app.location = currentPath;
                    
                    const files = await readdir(app.location);
                    
                    for(let i = 0; i < files.length; i++) {
                        filePath = currentPath + "\\" + files[i];
                        const fileStat = await lstat(filePath);

                        if (fileStat.isDirectory()) {
                            app.files.push({ id: i, name: files[i], isFolder: true})
                            app.tmpFiles.push({ id: i, name: files[i], isFolder: true })
                        } else {
                            app.files.push({ id: i, name: files[i], isFolder: false })
                            app.tmpFiles.push({ id: i, name: files[i], isFolder: false })
                        }

                    }
                    app.files = rearrange(app.files);
                } else {
                    app.fileContent = await readFile(currentPath, 'utf8')
                }
            } catch (e) {
                console.log(e)
            }
        }
    } else {
        if(currentPath.endsWith('.bpm') || currentPath.endsWith('.png') || currentPath.endsWith('.gif') || currentPath.endsWith('.jpg')) {
            app.imageRemote = 'file://' + currentPath;
        } else {
            app.imageRemote = null
            app.fileContentRemote = null
            app.filesRemote = []
            app.tmpFilesRemote = []
            
            try {
                const stat = await lstat(currentPath)
                
                if (stat.isDirectory()) {
                    app.locationRemote = currentPath
                    
                    const filesRemote = await readdir(app.locationRemote)

                    for(let i = 0; i < filesRemote.length; i++) {
                        filePathRemote = currentPath + "\\" + filesRemote[i];
                        const fileStatRemote = await lstat(filePathRemote);

                        if (fileStatRemote.isDirectory()) {
                            app.filesRemote.push({ id: i, name: filesRemote[i], isFolder: true})
                            app.tmpFilesRemote.push({ id: i, name: filesRemote[i], isFolder: true })
                        } else {
                            app.filesRemote.push({ id: i, name: filesRemote[i], isFolder: false })
                            app.tmpFilesRemote.push({ id: i, name: filesRemote[i], isFolder: false })
                        }
                    }
                    app.filesRemote = rearrange(app.filesRemote);
                } else {
                    app.fileContentRemote = await readFile(currentPath, 'utf8')
                }
            } catch (e) {
                console.log(e)
            }
        }
    }
}

function rearrange(files) {
    rearranged = [];
    reFolders = [];
    reFiles = [];
    for(let i = 0; i < files.length; i++) {
        if (files[i].isFolder) {
            reFolders.push(files[i]);
        } else {
            reFiles.push(files[i]);
        }
    }
    rearranged = reFolders.concat(reFiles);
    return rearranged;
}