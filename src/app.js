"use strict";

const path = nodeRequire('path');
const fs = nodeRequire('fs');
const childProcess = nodeRequire('child_process');
const del = nodeRequire('del');
const gulp = nodeRequire('gulp');
const extract = nodeRequire('extract-zip');
const electron = nodeRequire('electron');
const _ = nodeRequire('lodash');
const async = nodeRequire('async');
const remote = electron.remote;
const shell = electron.shell;
const dev = nodeRequire(path.join(__dirname, './src/_tasks/dev.js'));
const dist = nodeRequire(path.join(__dirname, './src/_tasks/dist.js'));
const zip = nodeRequire(path.join(__dirname, './src/_tasks/zip.js'));
const ftp = nodeRequire(path.join(__dirname, './src/_tasks/ftp.js'));
const Common = nodeRequire(path.join(__dirname, './src/common'));

//变量声明
let $welcome = $('#js-welcome');
let $example = $('#js-example');
let $openProject = $('#js-open-project');
let $newProject = $('#js-new-project');
let $projectList = $('#js-project-list');
let $delProject = $('#js-del-project');
let $buildDevButton = $('#js-build-dev');
let $logButton = $('#js-log-button');
let $log = $('#js-log');
let $logContent = $log.find('.logs__inner');
let $cleanLog = $('#js-clean-log');
let $settingButton = $('#js-setting-button');
let $settingClose = $('#js-setting-close');
let $formWorkspace = $('#js-form-workspace');
let $setting = $('#js-setting');
let $workspaceSection = $('#js-workspace');
let $delProjectBtn = $('#js-del-project-btn');
let $logStatus = $('#js-logs-status');
let changeTimer = null;
let $curProject = null;
let once = false;
let curConfigPath = Common.CONFIGPATH;
let config = nodeRequire(curConfigPath);
let FinderTitle = Common.PLATFORM === 'win32' ? '在 文件夹 中查看' : '在 Finder 中查看';
let bsObj = {};

//初始化
init();

//如果是第一次打开,设置数据并存储
//其他则直接初始化数据
function init() {

    let storage = Common.getStorage();

    if (!storage) {

        $welcome.removeClass('hide');

        storage = {};
        storage.name = Common.NAME;

        let workspace = path.join(remote.app.getPath(Common.DEFAULT_PATH), Common.WORKSPACE);

        $formWorkspace.val(workspace);

        storage.workspace = workspace;
        Common.setStorage(storage)
    } else {
        initData();
    }

}

//初始化数据
function initData() {
    let storage = Common.getStorage();
    let title = '';

    if (storage) {
        if (storage['workspace']) {
            $formWorkspace.val(storage['workspace']);
        }

        if (!_.isEmpty(storage['projects'])) {
            let html = '';

            for (let i in storage['projects']) {

                html += `<li class="projects__list-item" data-project="${i}" title="${storage['projects'][i]['path']}">
                              <span class="icon icon-finder" data-finder="true" title="${FinderTitle}"></span>
                              <div class="projects__list-content">
                                  <span class="projects__name">${i}</span>
                                  <div class="projects__path">${storage['projects'][i]['path']}</div>
                              </div>
                              <a href="javascript:;" class="icon icon-info projects__info"></a>
                        </li>`;
            }

            $projectList.html(html);

            //当前活动项目
            $curProject = $projectList.find('.projects__list-item').eq(0);
            $curProject.addClass('projects__list-item_current');

        } else {
            $welcome.removeClass('hide');
        }
    }
}

//导入示例项目
$example.on('click', function () {

    let storage = Common.getStorage();

    if (storage && storage['workspace']) {
        let projectName = Common.EXAMPLE_NAME;
        let projectPath = path.join(storage['workspace'], Common.EXAMPLE_NAME);

        if (storage.projects[projectName]) {
            //已经打开,直接切换
        } else {

            extract(Common.TEMPLAGE_EXAMPLE, {dir: storage['workspace']}, function (err) {
                if (err) {
                    throw new Error(err);
                }

                let $projectHtml = $(`<li class="projects__list-item" data-project="${Common.EXAMPLE_NAME}" title="${projectPath}">
                              <span class="icon icon-finder" data-finder="true" title="${FinderTitle}"></span>
                              <div class="projects__list-content">
                                  <span class="projects__name">${Common.EXAMPLE_NAME}</span>
                                  <div class="projects__path">${projectPath}</div>
                              </div>
                              <a href="javascript:;" class="icon icon-info projects__info"></a>
                        </li>`);

                $projectList.append($projectHtml);

                $projectList.scrollTop($projectList.get(0).scrollHeight);

                $projectHtml.trigger('click');

                storage['projects'][projectName] = {};
                storage['projects'][projectName]['path'] = projectPath;
                Common.setStorage(storage);

                console.log('new Project Success.');
            });
        }
    }

    if (!$welcome.hasClass('hide')) {
        $welcome.addClass('hide');
    }
});


//打开项目
$openProject.on('change', function () {
    if (this && this.files.length) {
        let projectPath = this.files[0].path;

        openProject(projectPath);

    } else {
        alert('选择目录出错,请重新选择!');
    }
});

$projectList[0].ondragover = function () {
    return false;
};
$projectList[0].ondragleave = $projectList[0].ondragend = function () {
    return false;
};
$projectList[0].ondrop = function (e) {
    e.preventDefault();
    var file = e.dataTransfer.files[0];

    var stat = fs.statSync(file.path);
    if (stat.isDirectory()) {
        openProject(file.path);
    }
    return false;
};

function openProject(projectPath) {

    let storage = Common.getStorage();
    let projectName = path.basename(projectPath);

    if (storage && storage['workspace']) {
        if (!storage['projects']) {
            storage['projects'] = {};
        }

        if (storage['projects'][projectName]) {
            alert('项目已存在');
        } else {
            storage['projects'][projectName] = {};
            storage['projects'][projectName]['path'] = projectPath;
            Common.setStorage(storage);

            //插入打开的项目
            insertOpenProject(projectPath);
        }
    }
}

//插入打开的项目
function insertOpenProject(projectPath) {

    if (!$welcome.hasClass('hide')) {
        $welcome.addClass('hide');
    }

    //插入节点
    let projectName = path.basename(projectPath);

    let $projectHtml = $(`<li class="projects__list-item" data-project="${projectName}" title="${projectPath}">
                              <span class="icon icon-finder" data-finder="true" title="${FinderTitle}"></span>
                              <div class="projects__list-content">
                                  <span class="projects__name">${projectName}</span>
                                  <div class="projects__path">${projectPath}</div>
                              </div>
                              <a href="javascript:;" class="icon icon-info projects__info"></a>
                        </li>`);

    $projectList.append($projectHtml);

    $projectList.scrollTop($projectList.get(0).scrollHeight);

    $projectHtml.trigger('click');

    //只有在节点成功插入了才保存进 storage
    let storage = Common.getStorage();

    if (storage) {
        if (!storage['projects']) {
            storage['projects'] = {};
        }
        if (!storage['projects'][projectName]) {
            storage['projects'][projectName] = {};
        }

        storage['projects'][projectName]['path'] = projectPath;

        Common.setStorage(storage);
    }

}

//删除项目
$delProject.on('click', function () {
    delProject();
});
$delProjectBtn.on('click', function () {
    delProject(function () {
        $setting.addClass('hide');
    });
});

function delProject(cb) {

    if (!$curProject.length) {
        return;
    }

    let projectName = $curProject.data('project');
    let index = $curProject.index();

    killBs();

    $curProject.remove();

    if (index > 0) {
        $curProject = $('.projects__list-item').eq(index - 1);
    } else {
        $curProject = $('.projects__list-item').eq(index);
    }

    $curProject.trigger('click');


    let storage = Common.getStorage();

    if (storage && storage['projects'] && storage['projects'][projectName]) {
        delete storage['projects'][projectName];
        Common.setStorage(storage);
    }

    if (_.isEmpty(storage['projects'])) {
        $welcome.removeClass('hide');
    }

    console.log('del project success.');

    cb && cb();
}

function killBs(){
    var projectPath = $curProject.attr('title');
    if (bsObj[projectPath]) {
        try {
            bsObj[projectPath].exit();
            logReply('Listening has quit.');
            console.log('Listening has quit.');
        } catch (err) {
            console.log(err);
        }
    }

    bsObj[$curProject.attr('title')] = null;
    setNormal();
}

//新建项目
$newProject.on('click', function () {
    newProjectFn();
});

function newProjectFn() {
    if (!$welcome.hasClass('hide')) {
        $welcome.addClass('hide');
    }

    let $projectHtml = $(`<li class="projects__list-item" data-project="" title="">
                              <span class="icon icon-finder" data-finder="true" title="${FinderTitle}"></span>
                              <div class="projects__list-content">
                                  <span class="projects__name" contenteditable></span>
                                  <div class="projects__path"></div>
                              </div>
                              <a href="javascript:;" class="icon icon-info projects__info"></a>
                        </li>`);

    $projectList.append($projectHtml);

    $projectList.scrollTop($projectList.get(0).scrollHeight);

    let $input = $projectHtml.find('.projects__name');

    $projectHtml.trigger('click');

    $input.get(0).focus();
    $input.hover();

    editName($projectHtml, $input);
}

var keyboard = false;
function editName($project, $input) {
    let text;
    let hasText = false;

    $input.keypress(function (event) {
            let $this = $(this);
                text = $.trim($this.text());

                if (event.which === 13 && !hasText) {
                    keyboard = true;
                    if (text !== '') {
                        setProjectInfo($project, $this, text);
                        hasText = true;
                         keyboard = false;
                    } else {
                        alert('请输入项目名');
                        
                        setTimeout(function(){
                            $this.html('');
                            this.focus();
                        }, 10)
                    }
                }
            
        })
        .blur(function () {
            let $this = $(this);
            text = $.trim($this.text());

            if(text){
                hasText = false;
                keyboard = false;
            }

            if (!hasText && !keyboard) {
                
                setTimeout(function(){
                    
                    if (text !== '') {
                        setProjectInfo($project, $this, text);

                        hasText = true;
                    } else {
                        alert('请输入项目名');
                        this.focus();
                    }
                }, 100);
            }
        });
}

//设置新建项目信息
function setProjectInfo($project, $input, text) {
    let storage = Common.getStorage();
    let projectPath;

    if (storage && storage['workspace']) {
        projectPath = path.join(storage['workspace'], text);

        if (!Common.dirExist(projectPath)) {
            $input.attr('contenteditable', false);
            $curProject = $project.remove();

            newProject(projectPath, function (projectPath) {
                newProjectReply(projectPath);
            });

        } else {
            alert(text + ' 项目已存在');
            $input.text('');
            editName($project, $input);
        }
    }

}

function newProject(projectPath, callback) {
    let workspace = path.dirname(projectPath);

    //先判断一下工作区是否存在
    if (!Common.dirExist(workspace)) {
        try {
            fs.mkdirSync(path.join(workspace));
        } catch (err) {
            throw new Error(err);
        }
    }

    //创建项目目录
    if (Common.dirExist(projectPath)) {
        throw new Error('project already exists');
    } else {
        try {
            fs.mkdirSync(path.join(projectPath));
        } catch (err) {
            throw new Error(err);
        }
    }

    extract(Common.TEMPLAGE_PROJECT, {dir: projectPath}, function (err) {
        if (err) {
            throw new Error(err);
        }

        callback(projectPath);
    });
}

function newProjectReply(projectPath) {
    let projectName = path.basename(projectPath);
    let storage = Common.getStorage();

    if (storage && storage['workspace']) {
        if (!storage['projects']) {
            storage['projects'] = {};
        }

        if (storage['projects'][projectName]) {
            alert('项目已存在');
        } else {
            storage['projects'][projectName] = {};
            storage['projects'][projectName]['path'] = projectPath;
            Common.setStorage(storage);

            $curProject.data('project', projectName);
            $curProject.attr('title', projectPath);
            $curProject.find('.projects__path').text(projectPath);

            $projectList.append($curProject);
        }

        $projectList.scrollTop($projectList.get(0).scrollHeight);

        console.log('new Project success.');

    }
}

//绑定任务按钮事件
$('#js-tasks').find('.tasks__button').on('click', function () {

    let taskName = $(this).data('task');

    runTask(taskName);

});

function runTask(taskName) {

    let projectPath = $curProject.attr('title');

    if (taskName === 'dev') {

        if ($buildDevButton.data('devwatch')) {

            killBs();

        } else {
            dev(projectPath, function (data) {
                logReply(data);
            }, function (bs) {
                bsObj[projectPath] = bs;
                setWatching();
                $logStatus.text('Done');
            });
        }

    }

    if (taskName === 'dist') {
        dist(projectPath, function (data) {
            logReply(data);
        }, function () {
            $logStatus.text('Done');
        });
    }

    if (taskName === 'zip') {
        dist(projectPath, function (data) {
            logReply(data);
        }, function () {
            zip(projectPath, function (data) {
                logReply(data);
            }, function () {
                $logStatus.text('Done');
            });
        });
    }

    if (taskName === 'ftp') {
        dist(projectPath, function (data) {
            logReply(data);
        }, function () {
            ftp(projectPath, function (data) {
                logReply(data);
            }, function () {
                $logStatus.text('Done');
            })
        })
    }
}

function logReply(data) {
    let D = new Date();
    let h = D.getHours();
    let m = D.getMinutes();
    let s = D.getSeconds();

    $logContent.append(`<div><span class="logs__time">[${h}:${m}:${s}]</span> ${data}</div>`);
    $logContent.scrollTop($logContent.get(0).scrollHeight);
}


//全局设置和项目设置
//点击全局设置按钮的时候
//1. 初始化数据
//2. 显示设置面板
//3. 显示 workspace 设置区域
//4. 隐藏 删除项目 按钮
$settingButton.on('click', function () {
    settingFn();
});

function settingFn() {
    curConfigPath = Common.CONFIGPATH;
    initConfig();

    if ($setting.hasClass('hide')) {
        $setting.removeClass('hide');
        $workspaceSection.removeClass('hide');
        $delProjectBtn.addClass('hide');
    } else {
        $setting.addClass('hide');
    }
}

//关闭设置面板
$settingClose.on('click', function () {
    $setting.addClass('hide');
});

$setting.on('change', 'input', function () {

    clearTimeout(changeTimer);

    let $this = $(this);

    if ($this.data('workspace')) {

        let storage = Common.getStorage();
        let originWorkspace = storage.workspace;

        storage.workspace = $.trim($this.val());

        gulp.src(path.join(originWorkspace, '/**/*'))
            .pipe(gulp.dest(storage.workspace))
            .on('end', function () {

                async.series([
                    function (next) {
                        if (Common.PLATFORM === 'win32') {
                            //windows 删除目录有bug
                            next();
                        } else {
                            del([originWorkspace], {force: true}).then(function () {
                                next();
                            })
                        }
                    },
                    function (next) {
                        //更新 localstorage
                        let projects = storage.projects;

                        async.eachSeries(projects, function (project, callback) {
                            project.path = project.path.replace(originWorkspace, storage.workspace);
                            callback();
                        }, function () {
                            Common.setStorage(storage);
                            next();
                        });
                    }
                ], function (error) {
                    if (error) {
                        throw new Error(error);
                    }

                    //更新 dom
                    initData();

                    console.log('workspace update success.');

                });

            });

    } else {
        updateConfig($this);
    }
});

//初始化设置面板数据
//重要的是每次都需要加载特定设置文件,如区分出是 全局, 或是 项目设置, 用一个全局变量 curConfigPath 保存着
function initConfig() {

    //需要去缓存加载
    config = Common.requireUncached(curConfigPath);

    for (let i in config) {

        if (i === 'ftp') {
            for (var j in config['ftp']) {
                let $el = $(`input[name=ftp-${j}]`);

                if ($el && $el.length) {
                    if ($el.attr('type') === 'text') {
                        $el.val(config['ftp'][j]);
                    } else {
                        $el.prop('checked', config['ftp'][j]);
                    }
                }
            }
        }

        let $el = $(`input[name=${i}]`);

        if ($el && $el.length) {
            if ($el.attr('type') === 'text') {
                $el.val(config[i]);
            } else {
                $el.prop('checked', config[i]);
            }
        }
    }
}

//更新配置
//为了不频繁更新,每次变动后隔1500毫秒后更新
function updateConfig($this) {
    let name = $this.attr('name');
    let val = $.trim($this.val());
    let checked = $this.prop('checked');
    let type = $this.attr('type');

    let nameArr = name.split('-');
    let pname = nameArr[0];
    let cname = nameArr[1];

    if (cname) {
        config[pname][cname] = type === 'text' ? val : checked;
    } else {
        config[pname] = type === 'text' ? val : checked;
    }

    //写入configPath
    changeTimer = setTimeout(function () {
        fs.writeFile(curConfigPath, JSON.stringify(config), function (err) {
            if (err) {
                throw new Error(err);
            }

            console.log('update config success.');
        })
    }, 1500);
}

//点击项目信息的时候
//1.先判断一下项目配置文件是否存在
//2.如果不存在则复制一份全局的过去
//3.初始化设置面板数据
//4.隐藏工作区设置
//5.显示 项目删除 按钮
//6.显示设置面板
$projectList.on('click', '.projects__info', function () {
    settingCurrentProject();
});

function settingCurrentProject() {
    let projectPath = $curProject.attr('title');
    curConfigPath = path.join(projectPath, Common.CONFIGNAME);

    //如果当前项目下的 config 不存在的时候,先挪过去
    if (!Common.fileExist(curConfigPath)) {
        gulp.src(Common.CONFIGPATH)
            .pipe(gulp.dest(projectPath))
            .on('end', function () {
                console.log('create weflow.config.json success');
                initConfig();
            });
    } else {
        initConfig();
    }

    $workspaceSection.addClass('hide');
    $delProjectBtn.removeClass('hide');
    $setting.removeClass('hide');
}


//log 切换
$logButton.on('click', function () {
    let $this = $(this);

    if ($this.hasClass('icon-log_green')) {
        $this.removeClass('icon-log_green');
    } else {
        $this.addClass('icon-log_green');
    }

    if ($log.hasClass('logs_show')) {
        $log.removeClass('logs_show');
        $projectList.removeClass('projects__list_high');
    } else {
        $log.addClass('logs_show');
        $projectList.addClass('projects__list_high');
    }
});

//项目列表绑定点击事件
$projectList.on('click', '.projects__list-item', function () {
    let $this = $(this);
    $('.projects__list-item').removeClass('projects__list-item_current');
    $this.addClass('projects__list-item_current');
    $curProject = $this;

    if ($this.data('watch')) {
        setWatching();
    } else {
        setNormal();
    }

});

function setNormal() {
    $buildDevButton.removeClass('tasks__button_watching');
    $buildDevButton.text('开发');
    $buildDevButton.data('devwatch', false);

    $curProject.removeClass('projects__list-item_watching');
    $curProject.data('watch', false);
}

function setWatching() {
    $buildDevButton.addClass('tasks__button_watching');
    $buildDevButton.text('监听中…');
    $buildDevButton.data('devwatch', true);

    $curProject.addClass('projects__list-item_watching');
    $curProject.data('watch', true);
}

$buildDevButton.hover(function () {
    let $this = $(this);
    if ($this.hasClass('tasks__button_watching')) {
        $this.text('停止');
    }
}, function () {
    let $this = $(this);
    if ($this.hasClass('tasks__button_watching')) {
        $this.text('监听中...');
    }
});

function showAbout() {
    const BrowserWindow = remote.BrowserWindow;

    let win = new BrowserWindow({
        width: 360,
        height: 400,
        resizable: false,
        title: '关于'
    });

    let aboutPath = 'file://' + __dirname + '/about.html';
    win.loadURL(aboutPath);

    // Emitted when the window is closed.
    win.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });
}

//打开项目所在目录
$projectList.on('click', '[data-finder=true]', function () {
    let $this = $(this);
    let projectPath = $this.parents('.projects__list-item').attr('title');

    if (projectPath) {
        shell.showItemInFolder(projectPath);
    }

});

//清除 log 信息
$cleanLog.on('click', function () {
    $logContent.html('');
});
