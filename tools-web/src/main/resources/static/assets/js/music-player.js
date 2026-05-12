let currentHost = "";
let musicInfo = null;

function setCurrentHost(input) {
    currentHost = input;
}

function setData(input) {
    try {
        musicInfo = JSON.parse(input).music_info;
    } catch (e) {
        console.log('数据异常，请重试', e);
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    // DOM元素
    const audioPlayer = new Audio();
    const coverImage = document.getElementById('coverImage');
    const coverBackground = document.getElementById('coverBackground');
    const coverPlaceholder = document.getElementById('coverPlaceholder');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const progressBar = document.getElementById('progressBar');
    const currentTimeDisplay = document.getElementById('currentTime');
    const totalTimeDisplay = document.getElementById('totalTime');
    const songTitle = document.getElementById('songTitle');
    const songArtist = document.getElementById('songArtist');
    const volumeControl = document.getElementById('volumeControl');
    const volumeIcon = document.getElementById('volumeIcon');
    const volumeValue = document.getElementById('volumeValue');
    const visualization = document.getElementById('visualization');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const repeatBtn = document.getElementById('repeatBtn');
    const audioFileInput = document.getElementById('audioFileInput');
    const coverFileInput = document.getElementById('coverFileInput');
    const lyricsFileInput = document.getElementById('lyricsFileInput');
    const lyricOverlay = document.getElementById('lyricOverlay');
    const lyricContent = document.getElementById('lyricContent');
    const lyricLines = document.getElementById('lyricLines');
    const lyricTitle = document.getElementById('lyricTitle');
    const closeLyrics = document.getElementById('closeLyrics');
    const showLyricsBtn = document.getElementById('showLyricsBtn');
    const coverArt = document.getElementById('coverArt');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const themeSelect = document.getElementById('themeSelect');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const visualizationSelect = document.getElementById('visualizationSelect');
    const autoplayToggle = document.getElementById('autoplayToggle');
    const crossfadeSelect = document.getElementById('crossfadeSelect');
    const cacheToggle = document.getElementById('cacheToggle');
    const resetSettings = document.getElementById('resetSettings');
    const clearCache = document.getElementById('clearCache');
    const notification = document.getElementById('notification');
    const refreshBackground = document.getElementById('refreshBackground');
    const dateTimeDisplay = document.getElementById('dateTime');
    const toggleMiniPlayer = document.getElementById('toggleMiniPlayer');
    const toggleFullscreen = document.getElementById('toggleFullscreen');
    const fullscreenMode = document.getElementById('fullscreenMode');
    const fullscreenCover = document.getElementById('fullscreenCover');
    const fullscreenTitle = document.getElementById('fullscreenTitle');
    const fullscreenArtist = document.getElementById('fullscreenArtist');
    const fullscreenPlayPause = document.getElementById('fullscreenPlayPause');
    const fullscreenPlayIcon = document.getElementById('fullscreenPlayIcon');
    const fullscreenPrev = document.getElementById('fullscreenPrev');
    const fullscreenNext = document.getElementById('fullscreenNext');
    const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
    const sleepTimerBtn = document.getElementById('sleepTimerBtn');
    const sleepTimerModal = document.getElementById('sleepTimerModal');
    const sleepOptions = document.querySelectorAll('.sleep-option');
    const timerDisplay = document.getElementById('timerDisplay');
    const setTimerBtn = document.getElementById('setTimer');
    const cancelTimerBtn = document.getElementById('cancelTimer');
    const playlistBtn = document.getElementById('playlistBtn');
    const playlistModal = document.getElementById('playlistModal');
    const playlistTabs = document.querySelectorAll('.playlist-tab');
    const tabContents = document.querySelectorAll('.playlist-tab-content');
    const closePlaylist = document.getElementById('closePlaylist');
    const playlistItems = document.getElementById('playlistItems');
    const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
    const shufflePlaylistBtn = document.getElementById('shufflePlaylist');
    const importPlaylistBtn = document.getElementById('importPlaylistBtn');
    const exportPlaylistBtn = document.getElementById('exportPlaylistBtn');
    const playlistCount = document.getElementById('playlistCount');
    const playlistDuration = document.getElementById('playlistDuration');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // 音质切换
    const changeQualityBtn = document.getElementById('changeQualityBtn');
    const qualityModal = document.getElementById('qualityModal');
    const qualityTabs = document.querySelectorAll('.quality-tab');
    const qualityTabContents = document.querySelectorAll('.quality-tab-content');
    const closeQualityModal = document.getElementById('closeQualityModal');

    // 新增的播放速度控制元素
    const speedButtons = document.querySelectorAll('.speed-btn');

    // 新增的均衡器相关元素
    const equalizerBtn = document.getElementById('equalizerBtn');
    const equalizerModal = document.getElementById('equalizerModal');
    const closeEqualizer = document.getElementById('closeEqualizer');
    const eqPresets = document.querySelectorAll('.eq-preset');
    const eqBandSliders = document.querySelectorAll('.eq-band-slider');
    const eqToggleBtn = document.getElementById('eqToggleBtn');

    // 状态变量
    let isPlaying = false;
    let currentRepeatMode = 'none'; // none, all, one
    let lyrics = [];
    let currentLyricIndex = -1;
    let updateInterval;
    let visualizationMode = 'bars';
    let visualizationAnimationFrame;
    let backgroundUpdateTimer;
    let currentTrackIndex = 0;
    let sleepTimeoutId = null;
    let sleepCountdownInterval = null;
    let sleepTimeRemaining = 0;
    let dragSrcElement = null;
    let isEqualizerEnabled = false;
    let currentPlaybackSpeed = 1.0;
    let isCacheEnabled = true;
    let lastPlayedPosition = 0;

    // 播放列表数组
    let playlist = [];

    // AudioContext 初始化
    let audioContext;
    let analyser;
    let audioSource;

    // 均衡器相关变量
    let equalizer = null;
    let equalizerBands = [];

    // 用于缓存的IndexedDB
    let db;

    const qualityInfo = new Map();
    qualityInfo.set('currentQualityName', 'defaultQuality');
    qualityInfo.set('currentQualityIndex', 0);

    // 预设均衡器参数
    const eqPresetValues = {
        normal: [0, 0, 0, 0, 0, 0, 0, 0],
        pop: [3, 2, 0, -2, -1, 0, 2, 3],
        rock: [4, 3, 2, 0, -1, 0, 3, 4],
        jazz: [3, 2, -1, -2, 0, 2, 3, 4],
        classic: [4, 3, 2, 1, 0, 1, 3, 4],
        bass: [6, 5, 4, 3, 0, 0, 0, 0]
    };

    // ----------------------------------------
    // 初始化函数
    // ----------------------------------------

    function init() {
        createVisualizationBars();
        loadSettings();
        updateDateTime();
        setInterval(updateDateTime, 1000);

        // 初始背景更新
        updateRandomBackground();

        // 初始化IndexedDB
        initDatabase()
            .then(() => {
                // 加载缓存的播放列表数据
                if (isCacheEnabled) {
                    loadCachedPlaylist();
                }
                // 添加事件监听器
                setupEventListeners();
            })
            .catch(error => {
                console.error('数据库初始化失败:', error);
                // 添加事件监听器
                setupEventListeners();
            });

        // 更新播放列表UI
        updatePlaylistUI();

        // 为body添加键盘控制
        document.body.addEventListener('keydown', handleKeyboardControls);

        // 确保音频元素正确初始化
        audioPlayer.playbackRate = 1.0;

        // 修复暂停按钮问题 - 添加正确的事件处理
        playPauseBtn.addEventListener('click', function () {
            togglePlayPause();
        });
    }

    // 初始化IndexedDB数据库
    function initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MusicPlayerDB', 1);

            request.onerror = function (event) {
                console.error('数据库打开失败:', event);
                reject(event);
            };

            request.onsuccess = function (event) {
                db = event.target.result;
                console.log('数据库打开成功');
                resolve();
            };

            request.onupgradeneeded = function (event) {
                const db = event.target.result;

                // 创建播放列表存储
                if (!db.objectStoreNames.contains('playlist')) {
                    const playlistStore = db.createObjectStore('playlist', {keyPath: 'id', autoIncrement: true});
                    playlistStore.createIndex('title', 'title', {unique: false});
                }

                // 创建音频文件存储
                if (!db.objectStoreNames.contains('audioFiles')) {
                    const audioStore = db.createObjectStore('audioFiles', {keyPath: 'id'});
                }

                // 创建封面图片存储
                if (!db.objectStoreNames.contains('coverImages')) {
                    const coverStore = db.createObjectStore('coverImages', {keyPath: 'id'});
                }

                // 创建歌词存储
                if (!db.objectStoreNames.contains('lyrics')) {
                    const lyricsStore = db.createObjectStore('lyrics', {keyPath: 'id'});
                }

                // 创建播放记录存储
                if (!db.objectStoreNames.contains('playbackState')) {
                    const stateStore = db.createObjectStore('playbackState', {keyPath: 'id'});
                }
            };
        });
    }

    // 创建可视化频谱柱
    function createVisualizationBars() {
        const barsCount = 32;
        visualization.innerHTML = '';

        for (let i = 0; i < barsCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = '3px';
            visualization.appendChild(bar);
        }
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 音频播放控制
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('loadedmetadata', updateTotalTime);
        audioPlayer.addEventListener('ended', handleTrackEnd);

        // 添加播放暂停事件，用于保存播放位置
        audioPlayer.addEventListener('pause', savePlaybackPosition);

        // 播放列表控制
        playlistBtn.addEventListener('click', togglePlaylistModal);
        closePlaylist.addEventListener('click', togglePlaylistModal);
        clearPlaylistBtn.addEventListener('click', clearPlaylist);
        shufflePlaylistBtn.addEventListener('click', shufflePlaylist);
        importPlaylistBtn.addEventListener('click', importPlaylist);
        exportPlaylistBtn.addEventListener('click', exportPlaylist);

        qualityTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;

                // 移除所有活动标签
                qualityTabs.forEach(t => t.classList.remove('active'));
                qualityTabContents.forEach(c => c.classList.remove('active'));

                // 激活选中的标签
                e.target.classList.add('active');
                const container = document.getElementById(tabId + 'Tab');
                container.classList.add('active');

                if (container.querySelectorAll(`input[name="${tabId}"]`).length > 0) {
                    return;
                }
                initQualityRadioData(container, tabId);
            });
        });

        async function initQualityRadioData(container, tabId) {
            const emptyContainer = container.querySelector('.quality-empty-container');
            emptyContainer.style.display = 'none';
            const loadingContainer = container.querySelector('.quality-loading-container');
            loadingContainer.innerHTML = `<div class="arc"></div><h1><span>LOADING</span></h1>`;
            loadingContainer.style.display = 'block';
            const urlList = [];
            await fetch(`${currentHost}tools/Kugou/api/playInfo?hash=${getHashWithAlbumId(qualityInfo.get('currentQualityName')).get("hash")}&albumId=${getHashWithAlbumId(qualityInfo.get('currentQualityName')).get("albumId")}`)
                .then(response => response.json()) // 解析 JSON
                .then(response => {
                    if (response.data.url !== null && response.data.url !== undefined && response.data.url.length > 0) {
                        emptyContainer.style.display = 'none';
                        container.innerHTML = '';
                        let index = 0;
                        response.data.url.forEach((url) => {
                            index = index + 1;
                            container.innerHTML = container.innerHTML + `<label><input type="radio" name="${tabId}" value="${url}" tabindex="${index - 1}" class="quality-radio"> 线路 - ${index}</label><br>`;
                            urlList.push(url);
                        });
                        qualityInfo.set(`${tabId}`, urlList.join(","));
                        container.querySelectorAll(`input[name="${tabId}"]`).forEach(radio => radio.addEventListener('click', onSelectQuality));
                    } else {
                        loadingContainer.innerHTML = '';
                        loadingContainer.style.display = 'none';
                        emptyContainer.style.display = 'block';
                    }
                })    // 处理数据
                .catch(error => {
                    console.error(error);
                    loadingContainer.innerHTML = '';
                    loadingContainer.style.display = 'none';
                    emptyContainer.style.display = 'block';
                }); // 处理错误
        }

        const onSelectQuality = (event) => {
            const radio = event.target;
            qualityInfo.set('currentQualityName', `${radio.name}`);
            qualityInfo.set('currentQualityIndex', `${radio.tabIndex}`);
        }

        const getHashWithAlbumId = (name) => {
            const params = new Map();
            params.set("hash", "null");
            params.set("albumId", "null");
            switch (name) {
                case 'defaultQuality':
                    params.set("hash", musicInfo.audio_info.play_info_list["128"].hash);
                    params.set("albumId", musicInfo.album_info.album_id);
                    break;
                case 'highQuality':
                    params.set("hash", musicInfo.audio_info.play_info_list["320"].hash);
                    params.set("albumId", musicInfo.album_info.album_id);
                    break;
                case 'flacQuality':
                    params.set("hash", musicInfo.audio_info.play_info_list["flac"].hash);
                    params.set("albumId", musicInfo.album_info.album_id);
                    break;
                default:
                    params.set("hash", "null");
                    params.set("albumId", "null");
                    break;
            }
            return params;
        }

        // 播放列表标签切换
        playlistTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;

                // 移除所有活动标签
                playlistTabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                // 激活选中的标签
                e.target.classList.add('active');
                document.getElementById(tabId + 'Tab').classList.add('active');
            });
        });

        // 进度条控制
        progressBar.addEventListener('input', seekTo);

        // 音量控制
        volumeControl.addEventListener('input', updateVolume);
        volumeIcon.addEventListener('click', toggleMute);

        // 播放速度控制
        speedButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                setPlaybackSpeed(parseFloat(btn.dataset.speed));

                // 更新按钮激活状态
                speedButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        changeQualityBtn.addEventListener('click', toggleQualityModal);
        closeQualityModal.addEventListener('click', toggleQualityModal);

        // 均衡器控制
        equalizerBtn.addEventListener('click', toggleEqualizerModal);
        closeEqualizer.addEventListener('click', toggleEqualizerModal);

        // 均衡器预设
        eqPresets.forEach(preset => {
            preset.addEventListener('click', () => {
                applyEqPreset(preset.dataset.preset);

                // 更新预设按钮状态
                eqPresets.forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        // 均衡器滑块
        eqBandSliders.forEach(slider => {
            slider.addEventListener('input', updateEqBand);
        });

        // 均衡器开关
        eqToggleBtn.addEventListener('click', toggleEqualizer);

        // 文件输入
        audioFileInput.addEventListener('change', handleAudioFile);
        coverFileInput.addEventListener('change', handleCoverFile);
        lyricsFileInput.addEventListener('change', handleLyricsFile);

        // 拖放文件上传区域
        const fileUploadArea = document.querySelector('.file-upload-area');
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileUploadArea.style.borderColor = 'var(--primary)';
        });

        fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileUploadArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const files = e.dataTransfer.files;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                if (file.type.startsWith('audio/')) {
                    handleAudioFileObject(file);
                } else if (file.type.startsWith('image/')) {
                    handleCoverFileObject(file);
                } else if (file.name.endsWith('.lrc') || file.name.endsWith('.txt')) {
                    handleLyricsFileObject(file);
                }
            }

            fileUploadArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        });

        // 歌词控制
        coverArt.addEventListener('click', toggleLyricOverlay);
        showLyricsBtn.addEventListener('click', toggleLyricOverlay);
        closeLyrics.addEventListener('click', toggleLyricOverlay);

        // 设置面板
        settingsBtn.addEventListener('click', toggleSettingsPanel);
        document.addEventListener('click', closeSettingsPanelOutside);
        themeSelect.addEventListener('change', updateTheme);
        darkModeToggle.addEventListener('change', toggleDarkMode);
        visualizationSelect.addEventListener('change', changeVisualizationMode);
        cacheToggle.addEventListener('change', toggleCache);
        resetSettings.addEventListener('click', resetAllSettings);
        clearCache.addEventListener('click', clearCacheData);

        // 背景刷新
        refreshBackground.addEventListener('click', updateRandomBackground);

        // 切换迷你播放器
        toggleMiniPlayer.addEventListener('click', toggleMiniPlayerMode);

        // 全屏控制
        toggleFullscreen.addEventListener('click', toggleFullscreenMode);
        fullscreenPlayPause.addEventListener('click', togglePlayPause);
        fullscreenPrev.addEventListener('click', playPreviousTrack);
        fullscreenNext.addEventListener('click', playNextTrack);
        exitFullscreenBtn.addEventListener('click', toggleFullscreenMode);

        // 全屏模式点击空白区域退出
        fullscreenMode.addEventListener('click', function (e) {
            // 确保点击的是背景区域，而不是控制按钮等元素
            if (e.target === fullscreenMode) {
                toggleFullscreenMode();
            }
        });

        // 睡眠定时器
        sleepTimerBtn.addEventListener('click', toggleSleepTimerModal);
        setTimerBtn.addEventListener('click', setSleepTimer);
        cancelTimerBtn.addEventListener('click', cancelSleepTimer);
        sleepOptions.forEach(option => {
            option.addEventListener('click', selectSleepOption);
        });

        // 重复播放模式
        repeatBtn.addEventListener('click', toggleRepeatMode);

        // 上一首/下一首
        prevBtn.addEventListener('click', playPreviousTrack);
        nextBtn.addEventListener('click', playNextTrack);
    }

    // ----------------------------------------
    // 缓存和播放记录功能
    // ----------------------------------------

    // 保存播放位置
    function savePlaybackPosition() {
        if (!isCacheEnabled || !db) return;

        // 只有当播放时间大于3秒时才保存位置，避免保存歌曲开头的位置
        if (audioPlayer.currentTime > 3) {
            lastPlayedPosition = audioPlayer.currentTime;

            const transaction = db.transaction(['playbackState'], 'readwrite');
            const store = transaction.objectStore('playbackState');

            // 保存当前播放状态
            store.put({
                id: 'currentState',
                trackIndex: currentTrackIndex,
                position: lastPlayedPosition,
                timestamp: new Date().getTime()
            });
        }
    }

    // 加载缓存的播放列表和状态
    function loadCachedPlaylist() {
        if (!db) return;

        showLoadingSpinner();

        // 加载播放列表元数据
        const playlistTransaction = db.transaction(['playlist'], 'readonly');
        const playlistStore = playlistTransaction.objectStore('playlist');

        const getAllRequest = playlistStore.getAll();
        getAllRequest.onsuccess = function () {
            const cachedPlaylistItems = getAllRequest.result;

            if (cachedPlaylistItems && cachedPlaylistItems.length > 0) {
                // 先加载播放列表元数据
                cachedPlaylistItems.forEach(item => {
                    const dummyFile = new File([""], item.title + ".mp3", {type: "audio/mpeg"});

                    addToPlaylist(dummyFile, {
                        title: item.title,
                        artist: item.artist || '未知艺术家',
                        duration: item.duration || 0,
                        id: item.id
                    }, false); // 不保存到本地存储，避免重复
                });

                // 然后加载媒体文件（音频、封面、歌词）
                loadCachedMediaFiles().then(() => {
                    // 最后加载播放状态
                    loadPlaybackState();
                    hideLoadingSpinner();
                });
            } else {
                hideLoadingSpinner();
            }
        };

        getAllRequest.onerror = function (event) {
            console.error('加载播放列表失败:', event);
            hideLoadingSpinner();
        };
    }

    // 加载缓存的媒体文件（音频、封面、歌词）
    function loadCachedMediaFiles() {
        return new Promise((resolve, reject) => {
            if (!db || playlist.length === 0) {
                resolve();
                return;
            }

            let loadedCount = 0;
            const totalItems = playlist.length;

            playlist.forEach((track, index) => {
                // 加载音频文件
                const audioTransaction = db.transaction(['audioFiles'], 'readonly');
                const audioStore = audioTransaction.objectStore('audioFiles');
                const audioRequest = audioStore.get(track.id);

                audioRequest.onsuccess = function () {
                    const audioData = audioRequest.result;
                    if (audioData && audioData.file) {
                        playlist[index].file = audioData.file;
                    }

                    // 加载封面
                    const coverTransaction = db.transaction(['coverImages'], 'readonly');
                    const coverStore = coverTransaction.objectStore('coverImages');
                    const coverRequest = coverStore.get(track.id);

                    coverRequest.onsuccess = function () {
                        const coverData = coverRequest.result;
                        if (coverData && coverData.file) {
                            playlist[index].cover = coverData.file;
                        }

                        // 加载歌词
                        const lyricsTransaction = db.transaction(['lyrics'], 'readonly');
                        const lyricsStore = lyricsTransaction.objectStore('lyrics');
                        const lyricsRequest = lyricsStore.get(track.id);

                        lyricsRequest.onsuccess = function () {
                            const lyricsData = lyricsRequest.result;
                            if (lyricsData) {
                                playlist[index].lyrics = lyricsData.lyrics;
                                playlist[index].lyricsArray = lyricsData.lyricsArray || [];
                                playlist[index].lyricsSections = lyricsData.lyricsSections || [];
                            }

                            loadedCount++;
                            if (loadedCount === totalItems) {
                                // 所有媒体文件加载完成
                                updatePlaylistUI();
                                resolve();
                            }
                        };

                        lyricsRequest.onerror = function (event) {
                            console.error('加载歌词失败:', event);
                            loadedCount++;
                            if (loadedCount === totalItems) {
                                updatePlaylistUI();
                                resolve();
                            }
                        };
                    };

                    coverRequest.onerror = function (event) {
                        console.error('加载封面失败:', event);
                        loadedCount++;
                        if (loadedCount === totalItems) {
                            updatePlaylistUI();
                            resolve();
                        }
                    };
                };

                audioRequest.onerror = function (event) {
                    console.error('加载音频失败:', event);
                    loadedCount++;
                    if (loadedCount === totalItems) {
                        updatePlaylistUI();
                        resolve();
                    }
                };
            });
        });
    }

    // 加载播放状态
    function loadPlaybackState() {
        if (!db) return;

        const transaction = db.transaction(['playbackState'], 'readonly');
        const store = transaction.objectStore('playbackState');
        const request = store.get('currentState');

        request.onsuccess = function () {
            const state = request.result;
            if (state && playlist.length > 0) {
                // 验证索引是否有效
                if (state.trackIndex >= 0 && state.trackIndex < playlist.length) {
                    currentTrackIndex = state.trackIndex;
                    lastPlayedPosition = state.position;

                    // 加载曲目并设置播放位置
                    loadTrack(currentTrackIndex, function () {
                        if (lastPlayedPosition > 0) {
                            audioPlayer.currentTime = lastPlayedPosition;
                            showNotification(`恢复播放: ${playlist[currentTrackIndex].title}`);
                        }
                    });
                } else {
                    // 索引无效，加载第一首歌曲
                    loadTrack(0);
                }
            }
        };

        request.onerror = function (event) {
            console.error('加载播放状态失败:', event);
        };
    }

    // 保存音频文件到缓存
    function saveAudioToCache(track) {
        if (!isCacheEnabled || !db || !track || !track.id || !track.file) return;

        const transaction = db.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');

        store.put({
            id: track.id,
            file: track.file
        });
    }

    // 保存封面到缓存
    function saveCoverToCache(track) {
        if (!isCacheEnabled || !db || !track || !track.id || !track.cover) return;

        const transaction = db.transaction(['coverImages'], 'readwrite');
        const store = transaction.objectStore('coverImages');

        store.put({
            id: track.id,
            file: track.cover
        });
    }

    // 保存歌词到缓存
    function saveLyricsToCache(track) {
        if (!isCacheEnabled || !db || !track || !track.id) return;

        const transaction = db.transaction(['lyrics'], 'readwrite');
        const store = transaction.objectStore('lyrics');

        store.put({
            id: track.id,
            lyrics: track.lyrics,
            lyricsArray: track.lyricsArray || [],
            lyricsSections: track.lyricsSections || []
        });
    }

    // 清除缓存数据
    function clearCacheData() {
        if (!db) return;

        if (confirm('确定要清除所有缓存的音乐和播放记录吗？这不会影响当前播放列表。')) {
            // 清除所有缓存数据
            const storeNames = ['audioFiles', 'coverImages', 'lyrics', 'playbackState', 'playlist'];

            storeNames.forEach(storeName => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const clearRequest = store.clear();

                clearRequest.onsuccess = function () {
                    console.log(`清除 ${storeName} 成功`);
                };

                clearRequest.onerror = function (event) {
                    console.error(`清除 ${storeName} 失败:`, event);
                };
            });

            showNotification('缓存数据已清除');
        }
    }

    // 切换缓存功能
    function toggleCache() {
        isCacheEnabled = cacheToggle.checked;
        localStorage.setItem('cacheEnabled', isCacheEnabled);

        if (isCacheEnabled) {
            showNotification('已启用缓存播放记录');

            // 如果启用了缓存，保存当前播放列表到缓存
            if (playlist.length > 0) {
                savePlaylistToCache();
            }
        } else {
            showNotification('已禁用缓存播放记录');
        }
    }

    // 保存播放列表到缓存
    function savePlaylistToCache() {
        if (!isCacheEnabled || !db) return;

        // 首先清除现有播放列表数据
        const clearTransaction = db.transaction(['playlist'], 'readwrite');
        const clearStore = clearTransaction.objectStore('playlist');
        clearStore.clear();

        // 然后保存新的播放列表数据
        const saveTransaction = db.transaction(['playlist'], 'readwrite');
        const saveStore = saveTransaction.objectStore('playlist');

        playlist.forEach((track, index) => {
            // 确保每个轨道有唯一ID
            if (!track.id) {
                track.id = Date.now() + index;
            }

            // 保存播放列表元数据
            saveStore.put({
                id: track.id,
                title: track.title,
                artist: track.artist,
                duration: track.duration
            });

            // 保存相关媒体文件
            saveAudioToCache(track);
            saveCoverToCache(track);
            saveLyricsToCache(track);
        });
    }

    // 显示加载指示器
    function showLoadingSpinner() {
        loadingSpinner.style.display = 'flex';
    }

    // 隐藏加载指示器
    function hideLoadingSpinner() {
        loadingSpinner.style.display = 'none';
    }

    // ----------------------------------------
    // 播放列表功能实现
    // ----------------------------------------

    // 添加音乐到播放列表
    function addToPlaylist(audioFile, metadata = {}, saveToStorage = true) {
        // 生成唯一ID
        const trackId = metadata.id || Date.now() + playlist.length;

        const track = {
            id: trackId,
            file: audioFile,
            title: metadata.title || audioFile.name.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, ''),
            artist: metadata.artist || '未知艺术家',
            duration: metadata.duration || 0,
            cover: metadata.cover || null,
            lyrics: metadata.lyrics || null,
            lyricsArray: metadata.lyricsArray || [],
            lyricsSections: metadata.lyricsSections || []
        };

        playlist.push(track);

        // 如果这是第一首添加的歌曲，自动加载它
        if (playlist.length === 1) {
            loadTrack(0);
        }

        // 更新播放列表UI
        updatePlaylistUI();

        // 显示通知
        showNotification(`已添加到播放列表: ${track.title}`);

        // 保存到本地存储
        if (saveToStorage) {
            savePlaylistToLocalStorage();

            // 如果启用了缓存，保存到IndexedDB
            if (isCacheEnabled && db) {
                savePlaylistToCache();
            }
        }
    }

    // 从播放列表移除歌曲
    function removeFromPlaylist(index) {
        if (index < 0 || index >= playlist.length) return;

        // 如果要删除的是当前播放的歌曲
        if (index === currentTrackIndex) {
            // 如果这是列表中唯一的歌曲
            if (playlist.length === 1) {
                resetPlayer();
            } else {
                // 如果删除的是最后一首，切换到第一首，否则保持当前索引
                if (index === playlist.length - 1) {
                    playlist.splice(index, 1);
                    currentTrackIndex = 0;
                } else {
                    playlist.splice(index, 1);
                    // currentTrackIndex保持不变，因为后面的歌曲会向前移动一位
                }
                loadTrack(currentTrackIndex);
            }
        } else {
            // 如果删除的是当前播放歌曲之前的歌曲，需要调整currentTrackIndex
            if (index < currentTrackIndex) {
                currentTrackIndex--;
            }
            playlist.splice(index, 1);
        }

        // 更新播放列表UI
        updatePlaylistUI();

        // 保存到本地存储
        savePlaylistToLocalStorage();

        // 如果启用了缓存，更新缓存
        if (isCacheEnabled && db) {
            savePlaylistToCache();
        }
    }

    // 清空播放列表
    function clearPlaylist() {
        if (confirm('确定要清空播放列表吗？')) {
            playlist = [];
            resetPlayer();
            updatePlaylistUI();
            savePlaylistToLocalStorage();

            // 如果启用了缓存，清除缓存中的播放列表
            if (isCacheEnabled && db) {
                const transaction = db.transaction(['playlist'], 'readwrite');
                const store = transaction.objectStore('playlist');
                store.clear();
            }

            showNotification('播放列表已清空');
        }
    }

    // 随机播放列表
    function shufflePlaylist() {
        if (playlist.length <= 1) {
            showNotification('播放列表中至少需要两首歌曲才能随机播放');
            return;
        }

        // 记住当前播放的歌曲
        const currentTrack = playlist[currentTrackIndex];

        // Fisher-Yates 洗牌算法
        for (let i = playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
        }

        // 更新当前播放歌曲的索引
        currentTrackIndex = playlist.findIndex(track => track === currentTrack);

        // 更新UI
        updatePlaylistUI();
        showNotification('已随机播放列表顺序');

        // 保存到本地存储
        savePlaylistToLocalStorage();

        // 如果启用了缓存，更新缓存
        if (isCacheEnabled && db) {
            savePlaylistToCache();
        }
    }

    // 导入播放列表
    function importPlaylist() {
        // 创建一个隐藏的文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                const reader = new FileReader();

                reader.onload = function (e) {
                    try {
                        const importedData = JSON.parse(e.target.result);

                        if (Array.isArray(importedData) && importedData.length > 0) {
                            // 确认是否要替换当前播放列表
                            if (playlist.length > 0 && !confirm('导入将替换当前播放列表，是否继续？')) {
                                return;
                            }

                            // 重置播放器和播放列表
                            resetPlayer();
                            playlist = [];

                            // 处理导入的数据
                            importedData.forEach(item => {
                                if (item.title) {
                                    // 创建一个虚拟音频文件
                                    const dummyFile = new File([""], item.title + ".mp3", {type: "audio/mpeg"});

                                    addToPlaylist(dummyFile, {
                                        title: item.title,
                                        artist: item.artist || '未知艺术家',
                                        duration: item.duration || 0
                                    });
                                }
                            });

                            showNotification(`已导入 ${importedData.length} 首歌曲`);
                        } else {
                            showNotification('导入的文件格式不正确');
                        }
                    } catch (error) {
                        console.error('导入播放列表失败:', error);
                        showNotification('导入失败：文件格式不正确');
                    }
                };

                reader.readAsText(this.files[0]);
            }
        });

        // 触发文件选择对话框
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    // 导出播放列表
    function exportPlaylist() {
        if (playlist.length === 0) {
            showNotification('播放列表为空，无法导出');
            return;
        }

        // 创建要导出的数据
        const exportData = playlist.map(track => ({
            title: track.title,
            artist: track.artist,
            duration: track.duration
        }));

        // 转换为JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], {type: 'application/json'});

        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'playlist-' + new Date().toISOString().slice(0, 10) + '.json';

        // 触发下载
        document.body.appendChild(a);
        a.click();

        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        showNotification('播放列表已导出');
    }

    // 重置播放器
    function resetPlayer() {
        audioPlayer.pause();
        audioPlayer.src = '';
        isPlaying = false;
        currentTrackIndex = 0;
        lastPlayedPosition = 0;

        // 重置UI
        playPauseIcon.className = 'fas fa-play';
        fullscreenPlayIcon.className = 'fas fa-play';
        songTitle.textContent = '未加载音乐';
        songArtist.textContent = '未知艺术家';
        coverImage.style.display = 'none';
        coverBackground.style.backgroundImage = 'none';
        coverPlaceholder.style.display = 'flex';
        progressBar.value = 0;
        currentTimeDisplay.textContent = '00:00';
        totalTimeDisplay.textContent = '00:00';

        // 清空歌词
        lyrics = [];
        lyricLines.innerHTML = '';

        // 重置播放状态缓存
        if (isCacheEnabled && db) {
            const transaction = db.transaction(['playbackState'], 'readwrite');
            const store = transaction.objectStore('playbackState');
            store.delete('currentState');
        }
    }

    // 加载指定索引的歌曲
    function loadTrack(index, callback) {
        if (playlist.length === 0 || index < 0 || index >= playlist.length) return false;

        // 停止当前播放
        audioPlayer.pause();

        currentTrackIndex = index;
        const track = playlist[index];

        // 加载音频文件
        if (track.file) {
            audioPlayer.src = track.file;
            audioPlayer.crossOrigin = 'anonymous';

            // 恢复播放速度设置
            audioPlayer.playbackRate = currentPlaybackSpeed;

            // 更新UI
            songTitle.textContent = track.title;
            songArtist.textContent = track.artist;

            // 检查歌曲标题是否需要滚动
            checkTitleScroll();

            // 加载封面
            if (track.cover) {
                coverImage.src = track.cover;
                coverImage.style.display = 'block';
                coverPlaceholder.style.display = 'none';

                // 更新封面背景
                coverBackground.style.backgroundImage = `url(${track.cover})`;

                // 更新全屏封面
                fullscreenCover.src = track.cover;
            } else {
                // 没有封面，显示占位符
                coverImage.style.display = 'none';
                coverBackground.style.backgroundImage = 'none';
                coverPlaceholder.style.display = 'flex';

                // 全屏模式下显示占位符
                fullscreenCover.src = '';
            }

            // 更新全屏模式信息
            fullscreenTitle.textContent = track.title;
            fullscreenArtist.textContent = track.artist;

            // 加载歌词
            if (track.lyrics) {
                parseLyrics(track.lyrics);
            } else if (track.lyricsArray && track.lyricsArray.length > 0) {
                lyrics = track.lyricsArray;
                if (track.lyricsSections && track.lyricsSections.length > 0) {
                    displayLyricsWithSections(track.lyricsArray, track.lyricsSections);
                } else {
                    segmentAndDisplayLyrics(track.lyricsArray);
                }
            } else {
                // 没有歌词
                lyrics = [];
                lyricLines.innerHTML = '<div class="lyric-line">暂无歌词</div>';
            }

            // 播放列表高亮当前播放项
            updatePlaylistHighlight();

            if (isPlaying) {
                audioPlayer.play().catch(e => console.error("播放失败:", e));
                playPauseIcon.className = 'fas fa-pause';
                fullscreenPlayIcon.className = 'fas fa-pause';
            }

            // 如果有回调函数，执行它
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            // 如果是虚拟文件（如导入的播放列表项），仅更新UI
            songTitle.textContent = track.title;
            songArtist.textContent = track.artist;
            showNotification('无法播放：找不到音频文件');
        }
        return true;
    }

    function changeQualityUI() {

    }

    // 更新播放列表UI
    function updatePlaylistUI() {
        playlistItems.innerHTML = '';

        if (playlist.length === 0) {
            playlistItems.innerHTML = '<li class="playlist-item">播放列表为空</li>';
            playlistCount.textContent = '0';
            playlistDuration.textContent = '00:00';
            return;
        }

        let totalDuration = 0;

        playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            li.dataset.index = index;
            if (index === currentTrackIndex) {
                li.classList.add('active');
            }

            // 启用拖拽排序
            li.draggable = true;
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('dragleave', handleDragLeave);
            li.addEventListener('drop', handleDrop);
            li.addEventListener('dragend', handleDragEnd);

            // 创建播放列表项内容
            const itemInfo = document.createElement('div');
            itemInfo.className = 'playlist-item-info';

            // 添加缩略图
            const thumb = document.createElement('div');
            thumb.className = 'playlist-item-thumb';

            if (track.cover) {
                const img = document.createElement('img');
                img.src = track.cover;
                thumb.appendChild(img);
            } else {
                thumb.innerHTML = '<i class="fas fa-music"></i>';
            }

            itemInfo.appendChild(thumb);

            // 添加标题和艺术家
            const details = document.createElement('div');
            details.className = 'playlist-item-details';

            const title = document.createElement('div');
            title.className = 'playlist-item-title';
            title.textContent = track.title;

            const artist = document.createElement('div');
            artist.className = 'playlist-item-artist';
            artist.textContent = track.artist;

            details.appendChild(title);
            details.appendChild(artist);
            itemInfo.appendChild(details);

            // 显示歌曲时长
            const duration = document.createElement('div');
            duration.className = 'playlist-item-duration';
            duration.textContent = formatTime(track.duration);

            // 创建控制按钮
            const controls = document.createElement('div');
            controls.className = 'playlist-controls';

            const playBtn = document.createElement('button');
            playBtn.className = 'playlist-btn';
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.title = '播放';
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadTrack(index);
                togglePlayPause(true);
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'playlist-btn';
            removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
            removeBtn.title = '从播放列表移除';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromPlaylist(index);
            });

            controls.appendChild(playBtn);
            controls.appendChild(removeBtn);

            // 将元素添加到列表项
            li.appendChild(itemInfo);
            li.appendChild(duration);
            li.appendChild(controls);

            // 点击列表项播放该歌曲
            li.addEventListener('click', () => {
                loadTrack(index);
                togglePlayPause(true);
            });

            playlistItems.appendChild(li);

            // 累计总时长
            totalDuration += track.duration;
        });

        // 更新播放列表计数和总时长
        playlistCount.textContent = playlist.length;
        playlistDuration.textContent = formatTime(totalDuration);
    }

    // 更新播放列表中当前播放歌曲的高亮
    function updatePlaylistHighlight() {
        const items = playlistItems.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            if (index === currentTrackIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // 切换播放列表模态框显示
    function togglePlaylistModal() {
        const isVisible = playlistModal.style.display === 'flex';
        playlistModal.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            updatePlaylistUI();
        }
    }

    // 保存播放列表到本地存储
    function savePlaylistToLocalStorage() {
        // 由于 File 对象无法直接序列化，我们只保存元数据
        const playlistData = playlist.map(track => ({
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            id: track.id
        }));

        localStorage.setItem('playlistMetadata', JSON.stringify(playlistData));
    }

    // 拖拽排序相关函数
    function handleDragStart(e) {
        dragSrcElement = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.index);
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
        return false;
    }

    function handleDragLeave() {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (dragSrcElement !== this) {
            const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = parseInt(this.dataset.index);

            // 移动数组元素
            const movedItem = playlist.splice(sourceIndex, 1)[0];
            playlist.splice(targetIndex, 0, movedItem);

            // 更新当前播放索引
            if (currentTrackIndex === sourceIndex) {
                currentTrackIndex = targetIndex;
            } else if (currentTrackIndex > sourceIndex && currentTrackIndex <= targetIndex) {
                currentTrackIndex--;
            } else if (currentTrackIndex < sourceIndex && currentTrackIndex >= targetIndex) {
                currentTrackIndex++;
            }

            // 更新UI
            updatePlaylistUI();
            savePlaylistToLocalStorage();

            // 如果启用了缓存，更新缓存
            if (isCacheEnabled && db) {
                savePlaylistToCache();
            }
        }

        this.classList.remove('drag-over');
        return false;
    }

    function handleDragEnd() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach(item => {
            item.classList.remove('dragging');
            item.classList.remove('drag-over');
        });
    }

    // ----------------------------------------
    // 文件处理功能
    // ----------------------------------------

    // 处理音频文件
    function handleAudioFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 重置文件输入
        e.target.value = '';

        handleAudioFileObject(file);
    }

    // 处理音频文件对象
    function handleAudioFileObject(file) {
        // 从文件名中提取艺术家和标题
        const fileName = file.name.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');
        let title = fileName;
        let artist = '未知艺术家';

        // 尝试分离艺术家和标题 (格式: 艺术家 - 标题)
        const separator = fileName.indexOf(' - ');
        if (separator !== -1) {
            artist = fileName.substring(0, separator);
            title = fileName.substring(separator + 3);
        }

        // 获取音频时长
        const tempUrl = URL.createObjectURL(file);
        const tempAudio = new Audio();
        tempAudio.src = tempUrl;

        tempAudio.addEventListener('loadedmetadata', () => {
            const duration = tempAudio.duration;
            URL.revokeObjectURL(tempUrl);

            // 添加到播放列表
            addToPlaylist(file, {
                title,
                artist,
                duration
            });
        });

        tempAudio.addEventListener('error', () => {
            URL.revokeObjectURL(tempUrl);
            showNotification('无法读取音频文件');
        });
    }

    // 处理封面图片文件
    function handleCoverFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 重置文件输入
        e.target.value = '';

        handleCoverFileObject(file);
    }

    // 处理封面文件对象
    function handleCoverFileObject(file) {
        if (playlist.length === 0) {
            showNotification('请先添加音乐文件');
            return;
        }

        // 更新当前播放的歌曲封面
        const fileReader = new FileReader();
        fileReader.onload = function (e) {
            coverImage.src = e.target.result;
            coverImage.style.display = 'block';
            coverPlaceholder.style.display = 'none';

            // 更新封面背景
            coverBackground.style.backgroundImage = `url(${e.target.result})`;

            // 更新全屏封面
            fullscreenCover.src = e.target.result;

            // 更新播放列表中的歌曲信息
            playlist[currentTrackIndex].cover = file;

            // 如果启用了缓存，保存封面到缓存
            if (isCacheEnabled && db) {
                saveCoverToCache(playlist[currentTrackIndex]);
            }

            // 更新播放列表UI
            updatePlaylistUI();
        };
        fileReader.readAsDataURL(file);
    }

    // 处理歌词文件
    function handleLyricsFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 重置文件输入
        e.target.value = '';

        handleLyricsFileObject(file);
    }

    // 处理歌词文件对象
    function handleLyricsFileObject(file) {
        if (playlist.length === 0) {
            showNotification('请先添加音乐文件');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            // 直接使用GBK编码解码歌词文件
            const decoder = new TextDecoder('gbk');
            const lyricsText = decoder.decode(new Uint8Array(e.target.result));
            // 解析歌词
            parseLyrics(lyricsText);

            // 保存歌词到播放列表
            playlist[currentTrackIndex].lyrics = lyricsText;
            playlist[currentTrackIndex].lyricsArray = lyrics;

            // 分析歌词并进行分段处理
            const sections = identifyLyricSections(lyrics);
            playlist[currentTrackIndex].lyricsSections = sections;

            // 显示分段歌词
            segmentAndDisplayLyrics(lyrics, sections);

            // 如果启用了缓存，保存歌词到缓存
            if (isCacheEnabled && db) {
                saveLyricsToCache(playlist[currentTrackIndex]);
            }

            showNotification('歌词已加载');
        };
        reader.readAsArrayBuffer(file);
    }

    // 解析LRC格式歌词
    function parseLyrics(lrc) {
        // 清空当前歌词
        lyrics = [];

        // 简单的LRC解析正则表达式
        const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
        const lines = lrc.split('\n');

        lines.forEach(line => {
            let match;
            while ((match = regex.exec(line)) !== null) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3]);

                // 转换为秒
                const time = minutes * 60 + seconds + milliseconds / (match[3].length === 2 ? 100 : 1000);
                const text = match[4].trim();

                if (text) {
                    lyrics.push({
                        time,
                        text
                    });
                }
            }
        });

        // 按时间排序
        lyrics.sort((a, b) => a.time - b.time);

        // 创建歌词显示
        displayLyrics();
    }

    // 识别歌词分段 - 新增功能
    function identifyLyricSections(lyricsArray) {
        if (!lyricsArray || lyricsArray.length === 0) return [];

        const sections = [];
        let currentSection = {
            title: '默认段落',
            startIndex: 0,
            endIndex: 0
        };

        // 识别空行或特殊标记作为分段标志
        for (let i = 0; i < lyricsArray.length; i++) {
            const line = lyricsArray[i].text;

            // 检测是否是段落标题行（无时间标记的行、全大写的行、或以特定词开头的行）
            if ((line.startsWith('[') && line.includes(']') && !line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/)) ||
                (line.toUpperCase() === line && line.length > 5) ||
                line.match(/^(verse|chorus|bridge|intro|outro|pre-chorus|hook|refrain|interlude)/i)) {

                // 结束上一个段落
                if (i > 0) {
                    currentSection.endIndex = i - 1;
                    sections.push({...currentSection});
                }

                // 开始新段落
                currentSection = {
                    title: line.replace(/[\[\]]/g, '').trim() || `段落 ${sections.length + 1}`,
                    startIndex: i,
                    endIndex: 0
                };
            }

            // 检测连续3个空行或省略号作为分段标志
            else if ((line === '' && i > 0 && lyricsArray[i - 1].text === '') ||
                line === '...' ||
                line === '…') {

                // 结束上一个段落
                currentSection.endIndex = i - 1;
                sections.push({...currentSection});

                // 开始新段落
                currentSection = {
                    title: `段落 ${sections.length + 1}`,
                    startIndex: i + 1,
                    endIndex: 0
                };
            }
        }

        // 最后一个段落
        currentSection.endIndex = lyricsArray.length - 1;
        sections.push(currentSection);

        // 过滤掉空段落
        return sections.filter(section => section.endIndex >= section.startIndex);
    }

    // 显示分段歌词 - 新增功能
    function segmentAndDisplayLyrics(lyricsArray, sections = null) {
        if (!lyricsArray || lyricsArray.length === 0) {
            lyricLines.innerHTML = '<div class="lyric-line">暂无歌词</div>';
            return;
        }

        // 如果没有提供分段信息，先识别分段
        if (!sections || sections.length === 0) {
            sections = identifyLyricSections(lyricsArray);
        }

        // 用于存储处理后的HTML
        lyricLines.innerHTML = '';

        // 如果有分段信息，按分段显示
        if (sections && sections.length > 0) {
            displayLyricsWithSections(lyricsArray, sections);
        } else {
            // 否则正常显示
            displayLyrics();
        }
    }

    // 按分段显示歌词
    function displayLyricsWithSections(lyricsArray, sections) {
        if (!lyricsArray || lyricsArray.length === 0 || !sections || sections.length === 0) {
            displayLyrics();
            return;
        }

        lyricLines.innerHTML = '';

        sections.forEach(section => {
            // 创建段落容器
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'lyric-section';

            // 添加段落标题
            // const titleDiv = document.createElement('div');
            // titleDiv.className = 'lyric-section-title';
            // titleDiv.textContent = section.title;
            // sectionDiv.appendChild(titleDiv);

            // 添加该段落的所有歌词行
            for (let i = section.startIndex; i <= section.endIndex && i < lyricsArray.length; i++) {
                const lyric = lyricsArray[i];
                const line = document.createElement('div');
                line.className = 'lyric-line';
                line.textContent = lyric.text;
                line.dataset.time = lyric.time;

                // 点击歌词跳转到对应时间
                line.addEventListener('click', () => {
                    audioPlayer.currentTime = lyric.time;
                });

                sectionDiv.appendChild(line);
            }

            lyricLines.appendChild(sectionDiv);
        });
    }

    // 显示普通歌词（无分段）
    function displayLyrics() {
        lyricLines.innerHTML = '';

        if (lyrics.length === 0) {
            lyricLines.innerHTML = '<div class="lyric-line">暂无歌词</div>';
            return;
        }

        lyrics.forEach(lyric => {
            const line = document.createElement('div');
            line.className = 'lyric-line';
            line.textContent = lyric.text;
            line.dataset.time = lyric.time;

            // 点击歌词跳转到对应时间
            line.addEventListener('click', () => {
                audioPlayer.currentTime = lyric.time;
            });

            lyricLines.appendChild(line);
        });
    }

    // 更新歌词高亮
    function updateLyricHighlight() {
        if (lyrics.length === 0) return;

        const currentTime = audioPlayer.currentTime;

        // 寻找当前应该高亮的歌词
        let index = -1;
        for (let i = lyrics.length - 1; i >= 0; i--) {
            if (lyrics[i].time <= currentTime) {
                index = i;
                break;
            }
        }

        // 如果高亮行没有变化，不做处理
        if (index === currentLyricIndex) return;
        currentLyricIndex = index;

        // 移除所有高亮
        const lines = lyricLines.querySelectorAll('.lyric-line');
        lines.forEach(line => line.classList.remove('active'));

        // 添加高亮
        if (index !== -1) {
            // 查找对应时间戳的行
            const currentLine = Array.from(lines).find(
                line => parseFloat(line.dataset.time) === lyrics[index].time
            );

            if (currentLine) {
                currentLine.classList.add('active');

                // 滚动到当前行
                if (lyricOverlay.style.display === 'flex') {
                    currentLine.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }
        }
    }

    // 切换歌词显示
    function toggleLyricOverlay() {
        const isVisible = lyricOverlay.style.display === 'flex';
        lyricOverlay.style.display = isVisible ? 'none' : 'flex';
        if (isVisible) {
            document.querySelector('.player-container').classList.remove('player-container-custom');
        } else {
            document.querySelector('.player-container').classList.add('player-container-custom');
        }

        if (!isVisible) {
            lyricTitle.textContent = songTitle.textContent;
            // 滚动到当前歌词
            updateLyricHighlight();
        }
    }

    // ----------------------------------------
    // 播放控制功能
    // ----------------------------------------

    // 播放/暂停切换
    function togglePlayPause(forcePlaying = false) {
        if (playlist.length === 0) {
            showNotification('请先添加音乐文件');
            return;
        }

        if (!audioPlayer.src) {
            loadTrack(currentTrackIndex);
        }

        if (forcePlaying) {
            audioPlayer.play().catch(e => console.error("播放失败:", e));
            isPlaying = true;
            playPauseIcon.className = 'fas fa-pause';
            fullscreenPlayIcon.className = 'fas fa-pause';
        } else if (audioPlayer.paused) {
            audioPlayer.play().catch(e => console.error("播放失败:", e));
            isPlaying = true;
            playPauseIcon.className = 'fas fa-pause';
            fullscreenPlayIcon.className = 'fas fa-pause';
        } else {
            audioPlayer.pause();
            isPlaying = false;
            playPauseIcon.className = 'fas fa-play';
            fullscreenPlayIcon.className = 'fas fa-play';
        }

        // 初始化音频可视化（如果尚未初始化）
        if (isPlaying && !audioContext) {
            initAudioVisualization();
        }

        // 初始化均衡器（如果尚未初始化且已经启用）
        if (isPlaying && isEqualizerEnabled && !equalizer) {
            initEqualizer();
        }
    }

    // 设置播放速度
    function setPlaybackSpeed(speed) {
        currentPlaybackSpeed = speed;
        audioPlayer.playbackRate = speed;
        showNotification(`播放速度: ${speed}x`);

        // 保存到本地存储
        localStorage.setItem('playbackSpeed', speed);
    }

    // 更新进度条
    function updateProgress() {
        if (isNaN(audioPlayer.duration)) return;

        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.value = percent;

        currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);

        // 更新歌词高亮
        updateLyricHighlight();

        // 更新可视化效果
        updateVisualization();
    }

    // 格式化时间为 MM:SS 格式
    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 跳转到指定进度
    function seekTo() {
        const seekTime = (progressBar.value / 100) * audioPlayer.duration;
        audioPlayer.currentTime = seekTime;
        if (isPlaying) {
            togglePlayPause();
            audioPlayer.play().catch(e => console.error("播放失败:", e));
            isPlaying = true;
            playPauseIcon.className = 'fas fa-pause';
            fullscreenPlayIcon.className = 'fas fa-pause';
        }
    }

    // 更新总时长显示
    function updateTotalTime() {
        totalTimeDisplay.textContent = formatTime(audioPlayer.duration);

        // 更新歌曲元数据中的时长
        if (playlist[currentTrackIndex]) {
            playlist[currentTrackIndex].duration = audioPlayer.duration;
        }
    }

    // 播放下一首
    function playNextTrack() {
        if (playlist.length <= 1) return;

        let nextIndex;
        if (currentRepeatMode === 'one') {
            // 单曲循环模式下仍然播放当前歌曲
            nextIndex = currentTrackIndex;
        } else {
            // 正常模式或全部循环模式
            nextIndex = (currentTrackIndex + 1) % playlist.length;
        }

        if (loadTrack(nextIndex)) {
            togglePlayPause(true);
        }
    }

    // 播放上一首
    function playPreviousTrack() {
        if (playlist.length <= 1) return;

        // 如果当前播放时间超过3秒，则重新播放当前歌曲
        if (audioPlayer.currentTime > 3) {
            audioPlayer.currentTime = 0;
            return;
        }

        let prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;

        if (loadTrack(prevIndex)) {
            togglePlayPause(true);
        }
    }

    // 处理歌曲结束事件
    function handleTrackEnd() {
        if (currentRepeatMode === 'one') {
            // 单曲循环
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(e => console.error("播放失败:", e));
        } else if (currentRepeatMode === 'all' || autoplayToggle.checked) {
            // 全部循环或自动播放下一首开启
            playNextTrack();
        } else {
            // 不循环且不自动播放，则停止在当前歌曲结尾
            isPlaying = false;
            playPauseIcon.className = 'fas fa-play';
            fullscreenPlayIcon.className = 'fas fa-play';
        }
    }

    // 切换重复播放模式
    function toggleRepeatMode() {
        switch (currentRepeatMode) {
            case 'none':
                currentRepeatMode = 'all';
                repeatBtn.classList.add('active');
                repeatBtn.classList.remove('repeat-one');
                showNotification('列表循环');
                break;
            case 'all':
                currentRepeatMode = 'one';
                repeatBtn.classList.add('repeat-one');
                showNotification('单曲循环');
                break;
            case 'one':
                currentRepeatMode = 'none';
                repeatBtn.classList.remove('active');
                repeatBtn.classList.remove('repeat-one');
                showNotification('不循环');
                break;
        }

        // 保存设置
        localStorage.setItem('repeatMode', currentRepeatMode);
    }

    // 更新音量
    function updateVolume() {
        audioPlayer.volume = volumeControl.value / 100;

        // 更新音量值显示
        volumeValue.textContent = volumeControl.value + '%';

        // 根据音量值更新图标
        updateVolumeIcon();

        // 保存到本地存储
        localStorage.setItem('volume', volumeControl.value);
    }

    // 更新音量图标
    function updateVolumeIcon() {
        const volume = volumeControl.value;
        const icon = volumeIcon.querySelector('i');

        if (volume == 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (volume < 30) {
            icon.className = 'fas fa-volume-off';
        } else if (volume < 70) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }

    // 切换静音
    function toggleMute() {
        if (audioPlayer.volume > 0) {
            // 记住当前音量
            volumeControl.dataset.lastVolume = volumeControl.value;
            // 设置为静音
            volumeControl.value = 0;
        } else {
            // 恢复之前的音量
            volumeControl.value = volumeControl.dataset.lastVolume || 50;
        }
        updateVolume();
    }

    // ----------------------------------------
    // 均衡器功能
    // ----------------------------------------

    // 初始化均衡器
    function initEqualizer() {
        if (!audioContext || !audioSource) {
            initAudioVisualization();
        }

        if (!equalizer) {
            // 断开现有连接
            audioSource.disconnect();

            // 创建均衡器滤波器
            const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000];
            equalizerBands = frequencies.map(frequency => {
                const filter = audioContext.createBiquadFilter();
                filter.type = 'peaking'; // 峰值滤波器
                filter.frequency.value = frequency;
                filter.Q.value = 1; // 品质因子
                filter.gain.value = 0; // 增益初始为0
                return filter;
            });

            // 连接滤波器
            audioSource.connect(equalizerBands[0]);
            for (let i = 0; i < equalizerBands.length - 1; i++) {
                equalizerBands[i].connect(equalizerBands[i + 1]);
            }
            equalizerBands[equalizerBands.length - 1].connect(analyser);

            // 更新均衡器UI状态
            updateEqSliders(eqPresetValues.normal);
            eqToggleBtn.textContent = '禁用均衡器';
            eqToggleBtn.classList.add('active');

            showNotification('已启用均衡器');
        }
    }

    function toggleQualityModal() {
        const isVisible = qualityModal.style.display === 'flex';
        qualityModal.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            changeQualityUI();
        }
    }

    // 切换均衡器模态框
    function toggleEqualizerModal() {
        const isVisible = equalizerModal.style.display === 'flex';
        equalizerModal.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible && !equalizer && isEqualizerEnabled) {
            initEqualizer();
        }
    }

    // 应用均衡器预设
    function applyEqPreset(presetName) {
        if (!equalizerBands.length) return;

        const presetValues = eqPresetValues[presetName] || eqPresetValues.normal;

        // 更新滤波器增益值
        equalizerBands.forEach((band, index) => {
            band.gain.value = presetValues[index] || 0;
        });

        // 更新滑块UI
        updateEqSliders(presetValues);

        showNotification(`已应用均衡器预设: ${presetName}`);
    }

    // 更新均衡器滑块UI
    function updateEqSliders(values) {
        eqBandSliders.forEach((slider, index) => {
            slider.value = values[index] || 0;
        });
    }

    // 更新单个均衡器频段
    function updateEqBand() {
        if (!equalizerBands.length) return;

        const index = Array.from(eqBandSliders).indexOf(this);
        const value = parseFloat(this.value);

        if (index >= 0 && index < equalizerBands.length) {
            equalizerBands[index].gain.value = value;
        }

        // 移除预设高亮
        eqPresets.forEach(preset => preset.classList.remove('active'));
    }

    // 切换均衡器启用状态
    function toggleEqualizer() {
        isEqualizerEnabled = !isEqualizerEnabled;

        if (isEqualizerEnabled) {
            // 启用均衡器
            initEqualizer();
            eqToggleBtn.textContent = '禁用均衡器';
            eqToggleBtn.classList.add('active');
        } else {
            // 禁用均衡器，恢复直接连接
            if (equalizer && audioSource) {
                // 断开均衡器链
                audioSource.disconnect();
                // 直接连接到分析器
                audioSource.connect(analyser);
                // 重置均衡器状态
                equalizer = null;
            }
            eqToggleBtn.textContent = '启用均衡器';
            eqToggleBtn.classList.remove('active');
            showNotification('已禁用均衡器');
        }

        // 保存设置
        localStorage.setItem('equalizerEnabled', isEqualizerEnabled);
    }

    // ----------------------------------------
    // 可视化和UI功能
    // ----------------------------------------

    // 初始化音频可视化
    function initAudioVisualization() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();

                // 调整分析器参数
                analyser.fftSize = 64;
                analyser.smoothingTimeConstant = 0.8;

                audioSource = audioContext.createMediaElementSource(audioPlayer);
                audioSource.connect(analyser);
                analyser.connect(audioContext.destination);
            } catch (e) {
                console.error('无法创建音频上下文:', e);
                return;
            }
        }
    }

    // 更新可视化效果
    function updateVisualization() {
        if (!audioContext || !analyser || visualizationMode === 'none') return;

        cancelAnimationFrame(visualizationAnimationFrame);

        // 根据当前可视化模式选择不同的渲染方法
        if (visualizationMode === 'bars') {
            renderBarVisualization();
        } else if (visualizationMode === 'circle') {
            renderCircleVisualization();
        }
    }

    // 渲染柱状可视化
    function renderBarVisualization() {
        const bars = visualization.querySelectorAll('.bar');
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        for (let i = 0; i < bars.length; i++) {
            // 使用对数刻度为低频提供更多可见度
            const barIndex = Math.floor(Math.pow(i / bars.length, 1.5) * dataArray.length);
            const value = dataArray[barIndex];
            const height = Math.max(3, value * 0.7); // 最小高度为3px
            bars[i].style.height = `${height}px`;

            // 根据频率创建渐变颜色
            const hue = 250 - (value / 255) * 50; // 从紫色到蓝色的渐变
            bars[i].style.backgroundColor = `hsl(${hue}, 70%, 60%)`;
        }

        visualizationAnimationFrame = requestAnimationFrame(renderBarVisualization);
    }

    // 渲染环形可视化（使用Canvas API）
    function renderCircleVisualization() {
        // 这里先简单提示，后续可以实现更高级的可视化效果
        showNotification('环形可视化效果尚未实现');
        visualizationMode = 'bars';
        visualizationSelect.value = 'bars';
        renderBarVisualization();
    }

    // 改变可视化模式
    function changeVisualizationMode() {
        visualizationMode = visualizationSelect.value;

        // 保存到本地存储
        localStorage.setItem('visualizationMode', visualizationMode);

        if (visualizationMode === 'none') {
            cancelAnimationFrame(visualizationAnimationFrame);
            const bars = visualization.querySelectorAll('.bar');
            bars.forEach(bar => bar.style.height = '3px');
        } else {
            updateVisualization();
        }
    }

    // 显示通知
    function showNotification(message) {
        notification.textContent = message;
        notification.classList.add('active');

        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }

    // 检查歌曲标题是否需要滚动
    function checkTitleScroll() {
        // 实际渲染宽度可能比你想象的要宽，所以加一个阈值
        const titleWidth = songTitle.scrollWidth;
        const containerWidth = songTitle.clientWidth;

        if (titleWidth > containerWidth * 1.1) {
            songTitle.classList.add('scrolling');
        } else {
            songTitle.classList.remove('scrolling');
        }
    }

    // ----------------------------------------
    // 设置和配置功能
    // ----------------------------------------

    // 切换设置面板
    function toggleSettingsPanel() {
        settingsPanel.classList.toggle('active');
    }

    // 点击设置面板外部关闭
    function closeSettingsPanelOutside(e) {
        if (settingsPanel.classList.contains('active') &&
            !settingsPanel.contains(e.target) &&
            e.target !== settingsBtn) {
            settingsPanel.classList.remove('active');
        }
    }

    // 更新主题
    function updateTheme() {
        const theme = themeSelect.value;

        // 更新CSS变量
        switch (theme) {
            case 'purple':
                document.documentElement.style.setProperty('--primary', '#8A2BE2');
                document.documentElement.style.setProperty('--secondary', '#BA55D3');
                break;
            case 'blue':
                document.documentElement.style.setProperty('--primary', '#4169E1');
                document.documentElement.style.setProperty('--secondary', '#00BFFF');
                break;
            case 'green':
                document.documentElement.style.setProperty('--primary', '#2E8B57');
                document.documentElement.style.setProperty('--secondary', '#3CB371');
                break;
            case 'pink':
                document.documentElement.style.setProperty('--primary', '#FF69B4');
                document.documentElement.style.setProperty('--secondary', '#FF1493');
                break;
        }

        // 保存到本地存储
        localStorage.setItem('theme', theme);
    }

    // 切换深色/浅色模式
    function toggleDarkMode() {
        const isDarkMode = darkModeToggle.checked;

        if (isDarkMode) {
            document.documentElement.style.setProperty('--dark', '#1A1A1A');
            document.documentElement.style.setProperty('--light', '#F8F8FF');
            document.body.style.color = '#F8F8FF';
        } else {
            document.documentElement.style.setProperty('--dark', '#F8F8FF');
            document.documentElement.style.setProperty('--light', '#1A1A1A');
            document.body.style.color = '#1A1A1A';
        }

        // 保存到本地存储
        localStorage.setItem('darkMode', isDarkMode);
    }

    // 加载存储的设置
    function loadSettings() {
        // 加载音量
        const savedVolume = localStorage.getItem('volume');
        if (savedVolume !== null) {
            volumeControl.value = savedVolume;
            updateVolume();
        }

        // 加载主题
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            themeSelect.value = savedTheme;
            updateTheme();
        }

        // 加载深色模式设置
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode !== null) {
            darkModeToggle.checked = savedDarkMode === 'true';
            toggleDarkMode();
        }

        // 加载可视化模式
        const savedVisualizationMode = localStorage.getItem('visualizationMode');
        if (savedVisualizationMode) {
            visualizationMode = savedVisualizationMode;
            visualizationSelect.value = savedVisualizationMode;
        }

        // 加载重复模式
        const savedRepeatMode = localStorage.getItem('repeatMode');
        if (savedRepeatMode) {
            currentRepeatMode = savedRepeatMode;
            if (currentRepeatMode === 'all') {
                repeatBtn.classList.add('active');
            } else if (currentRepeatMode === 'one') {
                repeatBtn.classList.add('active');
                repeatBtn.classList.add('repeat-one');
            }
        }

        // 加载自动播放设置
        const savedAutoplay = localStorage.getItem('autoplay');
        if (savedAutoplay !== null) {
            autoplayToggle.checked = savedAutoplay === 'true';
        }

        // 加载播放速度设置
        const savedPlaybackSpeed = localStorage.getItem('playbackSpeed');
        if (savedPlaybackSpeed !== null) {
            const speed = parseFloat(savedPlaybackSpeed);
            currentPlaybackSpeed = speed;
            audioPlayer.playbackRate = speed;

            // 更新播放速度按钮状态
            speedButtons.forEach(btn => {
                if (parseFloat(btn.dataset.speed) === speed) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // 加载均衡器设置
        const savedEqualizerEnabled = localStorage.getItem('equalizerEnabled');
        if (savedEqualizerEnabled !== null) {
            isEqualizerEnabled = savedEqualizerEnabled === 'true';
            if (isEqualizerEnabled) {
                eqToggleBtn.textContent = '禁用均衡器';
                eqToggleBtn.classList.add('active');
            }
        }

        // 加载缓存设置
        const savedCacheEnabled = localStorage.getItem('cacheEnabled');
        if (savedCacheEnabled !== null) {
            isCacheEnabled = savedCacheEnabled === 'true';
            cacheToggle.checked = isCacheEnabled;
        }
    }

    // 重置所有设置
    function resetAllSettings() {
        if (confirm('确定要重置所有设置吗？这不会删除您的播放列表。')) {
            localStorage.removeItem('volume');
            localStorage.removeItem('theme');
            localStorage.removeItem('darkMode');
            localStorage.removeItem('visualizationMode');
            localStorage.removeItem('repeatMode');
            localStorage.removeItem('autoplay');
            localStorage.removeItem('playbackSpeed');
            localStorage.removeItem('equalizerEnabled');
            localStorage.removeItem('cacheEnabled');

            // 重置UI
            volumeControl.value = 80;
            volumeValue.textContent = '80%';
            themeSelect.value = 'purple';
            darkModeToggle.checked = true;
            visualizationSelect.value = 'bars';
            visualizationMode = 'bars';
            currentRepeatMode = 'none';
            repeatBtn.classList.remove('active');
            repeatBtn.classList.remove('repeat-one');
            autoplayToggle.checked = true;
            cacheToggle.checked = true;
            isCacheEnabled = true;

            // 重置播放速度
            currentPlaybackSpeed = 1.0;
            audioPlayer.playbackRate = 1.0;
            speedButtons.forEach(btn => {
                btn.classList.remove('active');
                if (parseFloat(btn.dataset.speed) === 1.0) {
                    btn.classList.add('active');
                }
            });

            // 重置均衡器
            isEqualizerEnabled = false;
            if (equalizer) {
                audioSource.disconnect();
                audioSource.connect(analyser);
                equalizer = null;
            }
            eqToggleBtn.textContent = '启用均衡器';
            eqToggleBtn.classList.remove('active');

            // 应用重置的设置
            updateVolume();
            updateTheme();
            toggleDarkMode();

            showNotification('所有设置已重置');
        }
    }

    // ----------------------------------------
    // 工具函数
    // ----------------------------------------

    // 更新随机背景
    function updateRandomBackground() {
        // 添加时间戳参数避免缓存
        const timestamp = new Date().getTime();
        const bgUrl = `https://api.dujin.org/bing/1920.php?t=${timestamp}`;

        const background = document.querySelector('.background');

        // 创建一个新图片对象预加载
        const img = new Image();
        img.onload = function () {
            background.style.backgroundImage = `url(${bgUrl})`;
        };
        img.onerror = function () {
            console.error('背景图片加载失败');
        };
        img.src = bgUrl;
    }

    // 更新日期时间显示
    function updateDateTime() {
        const now = new Date();
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        dateTimeDisplay.textContent = now.toLocaleTimeString([], options);
    }

    // 切换迷你播放器模式
    function toggleMiniPlayerMode() {
        const playerContainer = document.querySelector('.player-container');
        playerContainer.classList.toggle('mini-mode');

        const icon = toggleMiniPlayer.querySelector('i');
        if (playerContainer.classList.contains('mini-mode')) {
            icon.className = 'fas fa-expand';
            showNotification('迷你模式已启用');
        } else {
            icon.className = 'fas fa-compress';
            showNotification('迷你模式已关闭');
        }
    }

    // 切换全屏模式
    function toggleFullscreenMode() {
        const isVisible = fullscreenMode.style.display === 'flex';
        fullscreenMode.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            // 更新全屏信息
            fullscreenTitle.textContent = songTitle.textContent;
            fullscreenArtist.textContent = songArtist.textContent;

            // 如果有封面，复制到全屏模式
            if (coverImage.style.display !== 'none') {
                fullscreenCover.src = coverImage.src;
            } else {
                fullscreenCover.src = '';
                // 可以创建一个占位符图像
            }

            // 同步播放状态图标
            fullscreenPlayIcon.className = playPauseIcon.className;
        }
    }

    // ----------------------------------------
    // 睡眠定时器功能
    // ----------------------------------------

    // 切换睡眠定时器模态框
    function toggleSleepTimerModal() {
        const isVisible = sleepTimerModal.style.display === 'flex';
        sleepTimerModal.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible && sleepTimeoutId) {
            // 更新剩余时间显示
            updateSleepTimerDisplay();
        }
    }

    // 选择睡眠选项
    function selectSleepOption() {
        sleepOptions.forEach(option => option.classList.remove('active'));
        this.classList.add('active');
    }

    // 设置睡眠定时器
    function setSleepTimer() {
        const activeOption = document.querySelector('.sleep-option.active');
        if (!activeOption) {
            showNotification('请选择定时器时长');
            return;
        }

        const minutes = parseInt(activeOption.dataset.minutes);
        if (isNaN(minutes)) return;

        // 清除现有定时器
        if (sleepTimeoutId) {
            clearTimeout(sleepTimeoutId);
            clearInterval(sleepCountdownInterval);
        }

        // 设置新定时器
        const milliseconds = minutes * 60 * 1000;
        sleepTimeRemaining = milliseconds;

        // 显示倒计时
        updateSleepTimerDisplay();

        // 启动倒计时更新
        sleepCountdownInterval = setInterval(updateSleepTimerDisplay, 1000);

        // 设置定时器结束时的操作
        sleepTimeoutId = setTimeout(() => {
            audioPlayer.pause();
            isPlaying = false;
            playPauseIcon.className = 'fas fa-play';
            fullscreenPlayIcon.className = 'fas fa-play';

            clearInterval(sleepCountdownInterval);
            showNotification('睡眠定时器已结束');

            // 重置定时器状态
            sleepTimeoutId = null;
            sleepCountdownInterval = null;
            sleepTimeRemaining = 0;
            timerDisplay.textContent = '00:00';

            // 更新按钮状态
            sleepTimerBtn.classList.remove('active');
        }, milliseconds);

        // 更新按钮状态
        sleepTimerBtn.classList.add('active');

        // 关闭模态框
        sleepTimerModal.style.display = 'none';

        showNotification(`睡眠定时器已设置: ${minutes} 分钟`);
    }

    // 更新睡眠定时器显示
    function updateSleepTimerDisplay() {
        if (sleepTimeRemaining <= 0) return;

        // 减少剩余时间
        sleepTimeRemaining -= 1000;
        if (sleepTimeRemaining < 0) sleepTimeRemaining = 0;

        // 计算分钟和秒钟
        const minutes = Math.floor(sleepTimeRemaining / 60000);
        const seconds = Math.floor((sleepTimeRemaining % 60000) / 1000);

        // 更新显示
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // 取消睡眠定时器
    function cancelSleepTimer() {
        if (sleepTimeoutId) {
            clearTimeout(sleepTimeoutId);
            clearInterval(sleepCountdownInterval);

            sleepTimeoutId = null;
            sleepCountdownInterval = null;
            sleepTimeRemaining = 0;

            // 重置显示
            timerDisplay.textContent = '00:00';

            // 更新按钮状态
            sleepTimerBtn.classList.remove('active');

            showNotification('睡眠定时器已取消');
        }

        // 关闭模态框
        sleepTimerModal.style.display = 'none';

        // 重置选项选择
        sleepOptions.forEach(option => option.classList.remove('active'));
    }

    // ----------------------------------------
    // 键盘快捷键支持
    // ----------------------------------------

    function handleKeyboardControls(e) {
        // 避免在输入框中触发快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        switch (e.key) {
            case ' ': // 空格键
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowRight': // 右箭头，快进5秒
                e.preventDefault();
                if (audioPlayer.src) {
                    audioPlayer.currentTime = Math.min(audioPlayer.currentTime + 5, audioPlayer.duration);
                }
                break;
            case 'ArrowLeft': // 左箭头，倒退5秒
                e.preventDefault();
                if (audioPlayer.src) {
                    audioPlayer.currentTime = Math.max(audioPlayer.currentTime - 5, 0);
                }
                break;
            case 'ArrowUp': // 上箭头，增加音量
                e.preventDefault();
                volumeControl.value = Math.min(parseInt(volumeControl.value) + 5, 100);
                updateVolume();
                break;
            case 'ArrowDown': // 下箭头，减小音量
                e.preventDefault();
                volumeControl.value = Math.max(parseInt(volumeControl.value) - 5, 0);
                updateVolume();
                break;
            case 'r': // R键，切换重复模式
            case 'R':
                toggleRepeatMode();
                break;
            case 'f': // F键，切换全屏
            case 'F':
                toggleFullscreenMode();
                break;
            case 'l': // L键，显示歌词
            case 'L':
                toggleLyricOverlay();
                break;
            case 'p': // P键，显示播放列表
            case 'P':
                togglePlaylistModal();
                break;
            case 's': // S键，显示睡眠定时器
            case 'S':
                toggleSleepTimerModal();
                break;
            case 'e': // E键，显示均衡器
            case 'E':
                toggleEqualizerModal();
                break;
            case 'm': // M键，切换迷你播放器
            case 'M':
                toggleMiniPlayerMode();
                break;
            case 'Escape': // ESC键，关闭所有面板
                if (fullscreenMode.style.display === 'flex') {
                    toggleFullscreenMode();
                } else if (lyricOverlay.style.display === 'flex') {
                    toggleLyricOverlay();
                } else if (playlistModal.style.display === 'flex') {
                    togglePlaylistModal();
                } else if (sleepTimerModal.style.display === 'flex') {
                    toggleSleepTimerModal();
                } else if (equalizerModal.style.display === 'flex') {
                    toggleEqualizerModal();
                } else if (settingsPanel.classList.contains('active')) {
                    settingsPanel.classList.remove('active');
                }
                break;
            // 新增播放速度快捷键
            case '1': // 1键，设置速度为1.0x
                setPlaybackSpeed(1.0);
                speedButtons.forEach(btn => {
                    btn.classList.toggle('active', parseFloat(btn.dataset.speed) === 1.0);
                });
                break;
            case '2': // 2键，设置速度为1.5x
                setPlaybackSpeed(1.5);
                speedButtons.forEach(btn => {
                    btn.classList.toggle('active', parseFloat(btn.dataset.speed) === 1.5);
                });
                break;
            case '3': // 3键，设置速度为2.0x
                setPlaybackSpeed(2.0);
                speedButtons.forEach(btn => {
                    btn.classList.toggle('active', parseFloat(btn.dataset.speed) === 2.0);
                });
                break;
            case '0': // 0键，设置速度为0.5x
                setPlaybackSpeed(0.5);
                speedButtons.forEach(btn => {
                    btn.classList.toggle('active', parseFloat(btn.dataset.speed) === 0.5);
                });
                break;
        }
    }

    // 下面一个逻辑相同
    const onSelectQuality = (event) => {
        const radio = event.target;
        qualityInfo.set('currentQualityName', `${radio.name}`);
        qualityInfo.set('currentQualityIndex', `${radio.tabIndex}`);
    }

    const getHashWithAlbumId = (name) => {
        const params = new Map();
        params.set("hash", "null");
        params.set("albumId", "null");
        switch (name) {
            case 'defaultQuality':
                params.set("hash", musicInfo.audio_info.play_info_list["128"].hash);
                params.set("albumId", musicInfo.album_info.album_id);
                break;
            case 'highQuality':
                params.set("hash", musicInfo.audio_info.play_info_list["320"].hash);
                params.set("albumId", musicInfo.album_info.album_id);
                break;
            case 'flacQuality':
                params.set("hash", musicInfo.audio_info.play_info_list["flac"].hash);
                params.set("albumId", musicInfo.album_info.album_id);
                break;
            default:
                params.set("hash", "null");
                params.set("albumId", "null");
                break;
        }
        return params;
    }

    init();

    if (musicInfo.lyric_info == null) {
        await fetch(`${currentHost}tools/Kugou/api?hash=${getHashWithAlbumId(qualityInfo.get('currentQualityName')).get("hash")}&albumId=${getHashWithAlbumId(qualityInfo.get('currentQualityName')).get("albumId")}&lyricInfo=true`)
            .then(response => response.json()) // 解析 JSON
            .then(response => {
                const lyric = response.data.lyric_info_data.decode_content;
                if (lyric !== null && lyric !== undefined && lyric !== "") {
                    musicInfo.lyric_info = lyric;
                }
            })    // 处理数据
            .catch(error => {
                console.error(error);
                emptyContainer.style.display = 'block';
            }); // 处理错误
    }

    if (document.querySelectorAll(`input[name="${qualityInfo.get('currentQualityName')}"]`).length > 0) {
        // 有数据
    } else {
        const container = document.getElementById('defaultQualityTab');
        const emptyContainer = document.querySelector('.quality-empty-container');
        const tabId = qualityInfo.get('currentQualityName');
        const urlList = [];
        await fetch(`${currentHost}tools/Kugou/api/playInfo?hash=${getHashWithAlbumId(qualityInfo.get('currentQualityName')).get("hash")}&albumId=${getHashWithAlbumId(qualityInfo.get('currentQualityName')).get("albumId")}`)
            .then(response => response.json()) // 解析 JSON
            .then(response => {
                if (response.data.url !== null && response.data.url !== undefined && response.data.url.length > 0) {
                    emptyContainer.style.display = 'none';
                    container.innerHTML = '';
                    let index = 0;
                    response.data.url.forEach((url) => {
                        index = index + 1;
                        container.innerHTML = container.innerHTML + `<label><input type="radio" name="${tabId}" value="${url}" tabindex="${index - 1}" class="quality-radio"> 线路 - ${index}</label><br>`;
                        urlList.push(url);
                    });
                    qualityInfo.set(`${tabId}`, urlList.join(","));
                    container.querySelectorAll(`input[name="${tabId}"]`).forEach(radio => radio.addEventListener('click', onSelectQuality));
                    if (urlList.length > 0) {
                        document.querySelector(`input[name="${tabId}"][value="${urlList[0]}"]`).checked = true;
                    }
                } else {
                    emptyContainer.style.display = 'block';
                }
            })    // 处理数据
            .catch(error => {
                console.error(error);
                emptyContainer.style.display = 'block';
            }); // 处理错误
    }

    try {
        const urlListContent = String(qualityInfo.get(qualityInfo.get('currentQualityName')));
        addToPlaylist(urlListContent.split(",")[qualityInfo.get('currentQualityIndex')], {
            title: `${musicInfo.songname}`,
            artist: `${musicInfo.author_name}` || '未知艺术家',
            duration: 0,
            id: `${musicInfo.audio_id}`,
            lyrics: `${musicInfo.lyric_info}`,
            cover: `${musicInfo.album_info.sizable_cover.replace("{size}", "1080")}`
        }, false); // 不保存到本地存储，避免重复
    } catch (e) {
        console.error('添加信息错误', e);
    }


});
